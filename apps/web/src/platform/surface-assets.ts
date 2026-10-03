import { parseSurfaceSpecJson, surfaceAssetResponseHeaders, validateSurfaceAsset } from "@buildmates/surfaces";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import type { UserId } from "@buildmates/domain";
import type { R2Like } from "./r2";

const EXTENSION: Record<string, string> = { "image/avif": "avif", "image/gif": "gif", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const SANITIZABLE_UPLOAD_TYPES = new Set(["image/jpeg", "image/png"]);
export const MAX_SURFACE_ASSET_BYTES = 12_000_000;
export const MAX_SURFACE_ASSET_OBJECTS = 100;
export const MAX_SURFACE_ASSET_TOTAL_BYTES = 200_000_000;
export const MAX_SURFACE_ASSET_DIMENSION = 8_192;
export const MAX_SURFACE_ASSET_PIXELS = 40_000_000;
const MAX_PUBLISHED_ASSET_CANDIDATES = 64;

export type ApprovedProfileMedia = {
  assetId: string;
  src: string;
  altText: string;
  projectId: string;
  projectTitle: string;
};

export type ApprovedProfileProject = { key: string; title: string };

export type SurfacePreviewAsset = {
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/avif" | "image/gif";
  base64: string;
};

const SURFACE_PREVIEW_SOURCE = /^\/api\/surface-assets\/([a-z0-9_-]+)\/([a-f0-9]{64}\.(?:avif|gif|jpe?g|png|webp))$/;
const SURFACE_PREVIEW_TYPES = new Set<SurfacePreviewAsset["contentType"]>(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"]);
const MAX_SURFACE_PREVIEW_ASSET_BYTES = 1_000_000;
const MAX_SURFACE_PREVIEW_TOTAL_BYTES = 2_000_000;

export async function uploadSurfaceAsset(input: { DB: RepositoryD1; bucket: R2Like; actorId: string; bytes: ArrayBuffer; claimedContentType: string; at?: Date }) {
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_SURFACE_ASSET_BYTES) throw new Error("surface_asset_size_invalid");
  const user = await input.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(input.actorId).first<{ id: string }>();
  if (!user) throw new Error("surface_asset_owner_forbidden");
  const submittedBytes = new Uint8Array(input.bytes);
  const contentType = detectSurfaceAssetType(submittedBytes);
  if (contentType !== input.claimedContentType.toLowerCase().split(";", 1)[0].trim()) throw new Error("surface_asset_signature_mismatch");
  if (!SANITIZABLE_UPLOAD_TYPES.has(contentType)) throw new Error("surface_asset_type_forbidden");
  const bytes = sanitizeSurfaceAssetUpload(submittedBytes, contentType);
  const sha256 = await hexDigest(bytes);
  const ownerDigest = await hexDigest(new TextEncoder().encode(`${input.actorId}\0${sha256}`));
  const id = `asset_${ownerDigest.slice(0, 32)}`;
  const objectKey = `surface-assets/${input.actorId}/${sha256}.${EXTENSION[contentType]}`;
  validateSurfaceAsset({ objectKey, contentType, byteSize: bytes.byteLength });
  const existing = await input.DB.prepare("SELECT id FROM surface_assets WHERE id=? AND owner_user_id=? AND object_key=? AND content_type=? AND byte_size=? AND sha256=? AND deleted_at IS NULL")
    .bind(id,input.actorId,objectKey,contentType,bytes.byteLength,sha256).first();
  if(existing)return { id, src: `/api/surface-assets/${input.actorId}/${sha256}.${EXTENSION[contentType]}`, contentType, byteSize: bytes.byteLength, sha256, sanitization: "container_metadata_stripped" as const };
  const usage=await input.DB.prepare("SELECT COUNT(*) AS objectCount,COALESCE(SUM(byte_size),0) AS totalBytes FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NULL")
    .bind(input.actorId).first<{objectCount:number;totalBytes:number}>();
  if(Number(usage?.objectCount??0)>=MAX_SURFACE_ASSET_OBJECTS||Number(usage?.totalBytes??0)+bytes.byteLength>MAX_SURFACE_ASSET_TOTAL_BYTES)throw new Error("surface_asset_quota_exceeded");
  const sanitizedBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  let storedInR2 = true;
  try {
    await input.bucket.put(objectKey, sanitizedBuffer, { httpMetadata: { contentType } });
  } catch (error) {
    if (!isUnavailableR2Write(error)) throw error;
    storedInR2 = false;
  }
  try {
    const insertAsset = input.DB.prepare("INSERT INTO surface_assets (id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NULL)<? AND (SELECT COALESCE(SUM(byte_size),0) FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NULL)+?<=? ON CONFLICT(id) DO NOTHING")
      .bind(id,input.actorId,objectKey,contentType,bytes.byteLength,sha256,(input.at??new Date()).getTime(),input.actorId,MAX_SURFACE_ASSET_OBJECTS,input.actorId,bytes.byteLength,MAX_SURFACE_ASSET_TOTAL_BYTES);
    if (storedInR2) await insertAsset.run();
    else await input.DB.batch([
      insertAsset,
      input.DB.prepare("INSERT INTO surface_asset_blobs(asset_id,bytes) SELECT ?,? WHERE EXISTS(SELECT 1 FROM surface_assets WHERE id=? AND owner_user_id=? AND deleted_at IS NULL) ON CONFLICT(asset_id) DO UPDATE SET bytes=excluded.bytes")
        .bind(id, sanitizedBuffer, id, input.actorId),
    ]);
  } catch(error) {
    // A failed D1 response does not prove the write was rolled back. Because the
    // R2 key is content-addressed, deleting it here could break a committed row
    // (or a concurrent upload) after an ambiguous database outcome. Orphan
    // cleanup must instead reconcile confirmed-unreferenced objects later.
    throw error;
  }
  const stored = await input.DB.prepare("SELECT id FROM surface_assets WHERE id=? AND owner_user_id=? AND object_key=? AND content_type=? AND byte_size=? AND sha256=? AND deleted_at IS NULL")
    .bind(id, input.actorId, objectKey, contentType, bytes.byteLength, sha256).first();
  const storedBlob = storedInR2 ? true : Boolean(await input.DB.prepare("SELECT asset_id FROM surface_asset_blobs WHERE asset_id=?").bind(id).first());
  if (!stored || !storedBlob) {
    if (storedInR2) await input.bucket.delete(objectKey).catch(()=>undefined);
    else await input.DB.batch([
      input.DB.prepare("DELETE FROM surface_asset_blobs WHERE asset_id=?").bind(id),
      input.DB.prepare("DELETE FROM surface_assets WHERE id=? AND owner_user_id=?").bind(id, input.actorId),
    ]).catch(()=>undefined);
    throw new Error("surface_asset_quota_exceeded");
  }
  return { id, src: `/api/surface-assets/${input.actorId}/${sha256}.${EXTENSION[contentType]}`, contentType, byteSize: bytes.byteLength, sha256, sanitization: "container_metadata_stripped" as const };
}

/**
 * Load already-authorized surface media for the trusted generated-surface
 * renderer. The caller validates the surface revision and approved asset list;
 * this boundary validates the path, D1 metadata, byte limits, and the actual
 * object bytes before returning an in-band resource.
 */
export async function loadSurfacePreviewAssets(input: {
  DB: RepositoryD1;
  bucket: R2Like;
  userId: string;
  surfaceId: string;
  sources: string[];
}): Promise<Record<string, SurfacePreviewAsset>> {
  if (!Array.isArray(input.sources) || input.sources.length > 24) throw new Error("surface_preview_media_invalid");
  const parsed = input.sources.map((source) => {
    if (typeof source !== "string") throw new Error("surface_preview_media_invalid");
    const match = SURFACE_PREVIEW_SOURCE.exec(source);
    if (!match) throw new Error("surface_preview_media_invalid");
    return { source, ownerId: match[1]!, filename: match[2]!, objectKey: `surface-assets/${match[1]}/${match[2]}` };
  });
  const unique = [...new Map(parsed.map((asset) => [asset.source, asset])).values()];
  if (!unique.length) return {};
  const placeholders = unique.map(() => "?").join(",");
  const rows = (await input.DB.prepare(`SELECT id,owner_user_id AS ownerId,object_key AS objectKey,content_type AS contentType,byte_size AS byteSize FROM surface_assets WHERE deleted_at IS NULL AND object_key IN (${placeholders})`).bind(...unique.map((asset) => asset.objectKey)).all<{ id: string; ownerId: string; objectKey: string; contentType: string; byteSize: number }>()).results;
  const byKey = new Map(rows.map((row) => [row.objectKey, row]));
  let totalBytes = 0;
  for (const asset of unique) {
    const row = byKey.get(asset.objectKey);
    if (!row || row.ownerId !== asset.ownerId || !SURFACE_PREVIEW_TYPES.has(row.contentType as SurfacePreviewAsset["contentType"])) throw new Error("surface_preview_media_invalid");
    const byteSize = Number(row.byteSize);
    if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_SURFACE_PREVIEW_ASSET_BYTES) throw new Error("surface_preview_media_too_large");
    totalBytes += byteSize;
    if (totalBytes > MAX_SURFACE_PREVIEW_TOTAL_BYTES) throw new Error("surface_preview_media_too_large");
  }
  const output: Record<string, SurfacePreviewAsset> = {};
  for (const asset of unique) {
    const row = byKey.get(asset.objectKey)!;
    const object = await input.bucket.get(asset.objectKey).catch(() => null);
    let bytes: Uint8Array | null = null;
    if (object?.arrayBuffer) bytes = new Uint8Array(await object.arrayBuffer());
    if (!bytes) {
      const fallback = await input.DB.prepare("SELECT bytes FROM surface_asset_blobs WHERE asset_id=?").bind(row.id).first<{ bytes: ArrayBuffer | Uint8Array }>();
      if (fallback?.bytes) bytes = fallback.bytes instanceof Uint8Array ? fallback.bytes : new Uint8Array(fallback.bytes);
    }
    if (!bytes || bytes.byteLength !== Number(row.byteSize)) throw new Error("surface_preview_media_unavailable");
    output[asset.source] = { contentType: row.contentType as SurfacePreviewAsset["contentType"], base64: bytesToBase64(bytes) };
  }
  return output;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  if (typeof btoa === "function") return btoa(binary);
  // Keep this worker-safe. Cloudflare runtimes do not expose Node's Buffer,
  // and the preview contract must still work in a test/runtime without btoa.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const hasSecond = offset + 1 < bytes.length;
    const hasThird = offset + 2 < bytes.length;
    const second = hasSecond ? bytes[offset + 1]! : 0;
    const third = hasThird ? bytes[offset + 2]! : 0;
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 0x03) << 4) | (second >> 4)];
    encoded += hasSecond ? alphabet[((second & 0x0f) << 2) | (third >> 6)] : "=";
    encoded += hasThird ? alphabet[third & 0x3f] : "=";
  }
  return encoded;
}

export async function listApprovedProfileMedia(input: { DB: RepositoryD1; actorId: string; limit?: number }): Promise<ApprovedProfileMedia[]> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 24), 1), 24);
  const [projectRows, profileRows] = await Promise.all([
    input.DB.prepare(`SELECT media.asset_id AS assetId,media.alt_text AS altText,
      project.id AS projectId,project.title AS projectTitle,asset.object_key AS objectKey,
      asset.content_type AS contentType,asset.byte_size AS byteSize
    FROM project_media media
    JOIN projects project ON project.id=media.project_id
    JOIN surface_assets asset ON asset.id=media.asset_id
    WHERE project.owner_user_id=? AND project.status='active' AND project.audience='public'
      AND project.published_at IS NOT NULL AND project.deleted_at IS NULL AND project.cohort_scope_id IS NULL
      AND asset.owner_user_id=? AND asset.deleted_at IS NULL
    ORDER BY project.updated_at DESC,media.position,media.id LIMIT ?`)
      .bind(input.actorId, input.actorId, limit).all<ProfileMediaRow>(),
    input.DB.prepare(`SELECT media.asset_id AS assetId,media.alt_text AS altText,
        media.project_key AS projectId,field.value_json AS projectsJson,asset.object_key AS objectKey,
        asset.content_type AS contentType,asset.byte_size AS byteSize
      FROM profile_project_media media
      JOIN profiles profile ON profile.id=media.profile_id
      JOIN profile_fields field ON field.profile_id=profile.id AND field.field_key='projects'
      JOIN surface_assets asset ON asset.id=media.asset_id
      WHERE profile.user_id=? AND field.audience='public' AND field.source_status='confirmed' AND field.cohort_scope_id IS NULL
        AND asset.owner_user_id=? AND asset.deleted_at IS NULL
      ORDER BY media.updated_at DESC LIMIT ?`)
      .bind(input.actorId, input.actorId, limit).all<ProfileMediaRow & { projectsJson: string }>(),
  ]);
  const profileMediaRows = profileRows.results.flatMap((row) => {
    const project = parseApprovedProfileProjects(row.projectsJson).find((item) => item.key === row.projectId);
    return project ? [{ ...row, projectTitle: project.title }] : [];
  });
  const rows = [...profileMediaRows, ...projectRows.results];
  const approved: ApprovedProfileMedia[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.assetId) || !row.altText.trim()) continue;
    try { validateSurfaceAsset({ objectKey: row.objectKey, contentType: row.contentType, byteSize: Number(row.byteSize) }); }
    catch { continue; }
    const prefix = `surface-assets/${input.actorId}/`;
    if (!row.objectKey.startsWith(prefix)) continue;
    seen.add(row.assetId);
    approved.push({
      assetId: row.assetId,
      src: `/api/surface-assets/${input.actorId}/${row.objectKey.slice(prefix.length)}`,
      altText: row.altText.trim().slice(0, 300),
      projectId: row.projectId,
      projectTitle: row.projectTitle,
    });
  }
  return approved;
}

export async function listApprovedProfileProjects(input: { DB: RepositoryD1; actorId: string }): Promise<ApprovedProfileProject[]> {
  const row = await input.DB.prepare(`SELECT field.value_json AS projectsJson
    FROM profiles profile JOIN profile_fields field ON field.profile_id=profile.id AND field.field_key='projects'
    WHERE profile.user_id=? AND field.audience='public' AND field.source_status='confirmed' AND field.cohort_scope_id IS NULL LIMIT 1`)
    .bind(input.actorId).first<{ projectsJson: string }>();
  return row ? parseApprovedProfileProjects(row.projectsJson) : [];
}

export async function associateProfileProjectMedia(input: {
  DB: RepositoryD1;
  actorId: string;
  assetId: string;
  projectKey: string;
  projectTitle: string;
  altText: string;
  at?: Date;
}): Promise<ApprovedProfileMedia> {
  const projectKey = input.projectKey.trim();
  const projectTitle = input.projectTitle.trim();
  const altText = input.altText.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}$/.test(projectKey)) throw new Error("profile_project_media_invalid");
  if (!projectTitle || projectTitle.length > 160 || !altText || altText.length > 300) throw new Error("profile_project_media_invalid");
  const profile = await input.DB.prepare("SELECT id FROM profiles WHERE user_id=? LIMIT 1")
    .bind(input.actorId).first<{ id: string }>();
  if (!profile) throw new Error("profile_required");
  const projects = await listApprovedProfileProjects({ DB: input.DB, actorId: input.actorId });
  const project = projects.find((item) => item.key === projectKey && item.title === projectTitle);
  if (!project) throw new Error("profile_project_not_approved");
  const asset = await input.DB.prepare(`SELECT id,object_key AS objectKey,content_type AS contentType,byte_size AS byteSize
    FROM surface_assets WHERE id=? AND owner_user_id=? AND deleted_at IS NULL`)
    .bind(input.assetId, input.actorId).first<{ id: string; objectKey: string; contentType: string; byteSize: number }>();
  if (!asset) throw new Error("surface_asset_not_owned");
  validateSurfaceAsset({ objectKey: asset.objectKey, contentType: asset.contentType, byteSize: Number(asset.byteSize) });
  const at = (input.at ?? new Date()).getTime();
  await input.DB.prepare(`INSERT INTO profile_project_media(profile_id,project_key,asset_id,alt_text,created_at,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(profile_id,project_key) DO UPDATE SET asset_id=excluded.asset_id,alt_text=excluded.alt_text,updated_at=excluded.updated_at`)
    .bind(profile.id, project.key, asset.id, altText, at, at).run();
  const prefix = `surface-assets/${input.actorId}/`;
  if (!asset.objectKey.startsWith(prefix)) throw new Error("surface_asset_not_owned");
  return {
    assetId: asset.id,
    src: `/api/surface-assets/${input.actorId}/${asset.objectKey.slice(prefix.length)}`,
    altText,
    projectId: project.key,
    projectTitle: project.title,
  };
}

export async function readSurfaceAsset(input: { DB: RepositoryD1; bucket: R2Like; viewerId: string | null; ownerId: string; filename: string }): Promise<Response> {
  if (!/^[a-f0-9]{64}\.(?:avif|gif|jpe?g|png|webp)$/i.test(input.filename)) return privateNotFound();
  const objectKey = `surface-assets/${input.ownerId}/${input.filename}`;
  const row = await input.DB.prepare("SELECT id,content_type AS contentType,byte_size AS byteSize FROM surface_assets WHERE owner_user_id=? AND object_key=? AND deleted_at IS NULL")
    .bind(input.ownerId, objectKey).first<{ id: string; contentType: string; byteSize: number }>();
  if (!row) return privateNotFound();
  if (input.viewerId !== input.ownerId) {
    const candidates = (await input.DB.prepare("SELECT r.id,r.design_policy_version AS designPolicyVersion,r.spec_json AS specJson FROM surfaces s JOIN surface_revisions r ON r.id=s.published_revision_id WHERE s.owner_user_id=? AND r.status='published' AND r.spec_json LIKE ? ORDER BY s.updated_at DESC LIMIT ?")
      .bind(input.ownerId, `%${row.id}%`, MAX_PUBLISHED_ASSET_CANDIDATES).all<{ id: string; designPolicyVersion: string; specJson: string }>()).results;
    const repositories = createD1Repositories(input.DB);
    let authorized = false;
    for (const candidate of candidates) {
      let parsed;
      try { parsed = parseSurfaceSpecJson(candidate.specJson, candidate.designPolicyVersion); } catch { continue; }
      if (!parsed.approvedAssets.some((asset) => asset.id === row.id && asset.src === `/api/surface-assets/${input.ownerId}/${input.filename}`)) continue;
      if (await repositories.surfaces.findRevisionForViewer(candidate.id, input.viewerId as UserId | null)) { authorized = true; break; }
    }
    if (!authorized) return privateNotFound();
  }
  validateSurfaceAsset({ objectKey, contentType: row.contentType, byteSize: row.byteSize });
  const object = await input.bucket.get(objectKey).catch(() => null);
  if (object?.arrayBuffer) return new Response(await object.arrayBuffer(), { status: 200, headers: surfaceAssetResponseHeaders(row.contentType) });
  const fallback = await input.DB.prepare("SELECT bytes FROM surface_asset_blobs WHERE asset_id=?").bind(row.id).first<{ bytes: ArrayBuffer | Uint8Array }>();
  if (!fallback?.bytes) return privateNotFound();
  const fallbackBytes = fallback.bytes instanceof Uint8Array ? fallback.bytes : new Uint8Array(fallback.bytes);
  if (fallbackBytes.byteLength !== Number(row.byteSize)) return privateNotFound();
  const fallbackBody = fallbackBytes.buffer.slice(fallbackBytes.byteOffset, fallbackBytes.byteOffset + fallbackBytes.byteLength) as ArrayBuffer;
  return new Response(fallbackBody, { status: 200, headers: surfaceAssetResponseHeaders(row.contentType) });
}

export async function readRequestBodyWithLimit(request: Request, limit = MAX_SURFACE_ASSET_BYTES): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("surface_asset_size_invalid");
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new Error("surface_asset_size_invalid");
  if (!request.body) throw new Error("surface_asset_size_invalid");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel("surface_asset_size_invalid").catch(() => undefined);
        throw new Error("surface_asset_size_invalid");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total < 1) throw new Error("surface_asset_size_invalid");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

export function detectSurfaceAssetType(bytes: Uint8Array): string {
  const ascii = (offset: number, length: number) => new TextDecoder("latin1").decode(bytes.slice(offset, offset + length));
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && ascii(4, 4) === "ftyp" && /^(?:avif|avis|mif1|msf1)$/.test(ascii(8, 4))) return "image/avif";
  throw new Error("surface_asset_signature_forbidden");
}

export function sanitizeSurfaceAssetUpload(bytes: Uint8Array, contentType: string): Uint8Array {
  if (contentType === "image/png") return sanitizePng(bytes);
  if (contentType === "image/jpeg") return sanitizeJpeg(bytes);
  throw new Error("surface_asset_type_forbidden");
}

function sanitizePng(bytes: Uint8Array): Uint8Array {
  const signature = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  if (bytes.length < 45 || !signature.every((value,index)=>bytes[index]===value)) throw new Error("surface_asset_structure_invalid");
  const chunks: Uint8Array[] = [bytes.slice(0,8)];
  const safeAncillary = new Set(["cHRM","gAMA","iCCP","sBIT","sRGB","bKGD","pHYs","tRNS"]);
  const critical = new Set(["IHDR","PLTE","IDAT","IEND"]);
  let offset=8, width=0, height=0, sawHeader=false, sawData=false, sawEnd=false;
  while(offset<bytes.length){
    if(offset+12>bytes.length)throw new Error("surface_asset_structure_invalid");
    const length=readU32(bytes,offset); const end=offset+12+length;
    if(!Number.isSafeInteger(end)||end>bytes.length)throw new Error("surface_asset_structure_invalid");
    const type=new TextDecoder("latin1").decode(bytes.slice(offset+4,offset+8));
    if(!/^[A-Za-z]{4}$/.test(type))throw new Error("surface_asset_structure_invalid");
    const expected=readU32(bytes,offset+8+length); const actual=crc32(bytes.slice(offset+4,offset+8+length));
    if(actual!==expected)throw new Error("surface_asset_structure_invalid");
    if(!sawHeader){
      if(type!=="IHDR"||length!==13)throw new Error("surface_asset_structure_invalid");
      width=readU32(bytes,offset+8);height=readU32(bytes,offset+12);assertSurfaceDimensions(width,height);
      if(bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)throw new Error("surface_asset_structure_invalid");
      sawHeader=true;
    } else if(type==="IHDR")throw new Error("surface_asset_structure_invalid");
    if(type==="IDAT")sawData=true;
    if(type==="IEND"){
      if(length!==0||!sawData||end!==bytes.length)throw new Error("surface_asset_structure_invalid");
      sawEnd=true;
    }
    const isCritical=type[0]===type[0].toUpperCase();
    if(isCritical&&!critical.has(type))throw new Error("surface_asset_structure_invalid");
    if(critical.has(type)||safeAncillary.has(type))chunks.push(bytes.slice(offset,end));
    offset=end;
    if(sawEnd)break;
  }
  if(!sawHeader||!sawData||!sawEnd||width<1||height<1)throw new Error("surface_asset_structure_invalid");
  return concatBytes(chunks);
}

function sanitizeJpeg(bytes: Uint8Array): Uint8Array {
  if(bytes.length<16||bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error("surface_asset_structure_invalid");
  const chunks:Uint8Array[]=[bytes.slice(0,2)];
  const sofMarkers=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset=2,width=0,height=0,sawScan=false,sawEnd=false;
  while(offset<bytes.length){
    if(bytes[offset]!==0xff)throw new Error("surface_asset_structure_invalid");
    const markerStart=offset;
    while(offset<bytes.length&&bytes[offset]===0xff)offset++;
    if(offset>=bytes.length)throw new Error("surface_asset_structure_invalid");
    const marker=bytes[offset++];
    if(marker===0x00||marker===0xd8)throw new Error("surface_asset_structure_invalid");
    if(marker===0xd9){
      if(offset!==bytes.length||!sawScan)throw new Error("surface_asset_structure_invalid");
      chunks.push(bytes.slice(markerStart,offset));sawEnd=true;break;
    }
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){
      chunks.push(bytes.slice(markerStart,offset));continue;
    }
    if(offset+2>bytes.length)throw new Error("surface_asset_structure_invalid");
    const length=(bytes[offset]<<8)|bytes[offset+1];
    if(length<2||offset+length>bytes.length)throw new Error("surface_asset_structure_invalid");
    const segmentEnd=offset+length;
    if(sofMarkers.has(marker)){
      if(length<8)throw new Error("surface_asset_structure_invalid");
      height=(bytes[offset+3]<<8)|bytes[offset+4];width=(bytes[offset+5]<<8)|bytes[offset+6];assertSurfaceDimensions(width,height);
    }
    const metadata=(marker>=0xe0&&marker<=0xef)||marker===0xfe;
    if(!metadata)chunks.push(bytes.slice(markerStart,segmentEnd));
    offset=segmentEnd;
    if(marker===0xda){
      sawScan=true;
      const entropyStart=offset;
      while(offset<bytes.length){
        if(bytes[offset++]!==0xff)continue;
        while(offset<bytes.length&&bytes[offset]===0xff)offset++;
        if(offset>=bytes.length)throw new Error("surface_asset_structure_invalid");
        const next=bytes[offset];
        if(next===0x00||(next>=0xd0&&next<=0xd7)){offset++;continue;}
        chunks.push(bytes.slice(entropyStart,offset-1));
        offset--;
        break;
      }
    }
  }
  if(!sawEnd||!sawScan||width<1||height<1)throw new Error("surface_asset_structure_invalid");
  return concatBytes(chunks);
}

function assertSurfaceDimensions(width:number,height:number){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>MAX_SURFACE_ASSET_DIMENSION||height>MAX_SURFACE_ASSET_DIMENSION||width*height>MAX_SURFACE_ASSET_PIXELS)throw new Error("surface_asset_dimensions_invalid");
}

function readU32(bytes:Uint8Array,offset:number){return ((bytes[offset]*0x1000000)+((bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3]))>>>0;}
function concatBytes(chunks:Uint8Array[]){const size=chunks.reduce((total,chunk)=>total+chunk.byteLength,0);const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const value of bytes){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}

async function hexDigest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function privateNotFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization" } });
}

function isUnavailableR2Write(error: unknown): boolean {
  return error instanceof Error && /RPC receiver does not implement the method ["']put["']/i.test(error.message);
}

type ProfileMediaRow = { assetId: string; altText: string; projectId: string; projectTitle: string; objectKey: string; contentType: string; byteSize: number };

function parseApprovedProfileProjects(raw: string): ApprovedProfileProject[] {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const project = item as Record<string, unknown>;
    const key = typeof project.id === "string" ? project.id.trim() : "";
    const title = typeof project.title === "string" ? project.title.trim() : "";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}$/.test(key) || !title || title.length > 160 || seen.has(key)) return [];
    seen.add(key);
    return [{ key, title }];
  }).slice(0, 20);
}
