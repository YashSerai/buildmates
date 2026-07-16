import { parseSurfaceSpecJson, surfaceAssetResponseHeaders, validateSurfaceAsset } from "@buildmates/surfaces";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import type { UserId } from "@buildmates/domain";
import type { R2Like } from "./r2";

const EXTENSION: Record<string, string> = { "image/avif": "avif", "image/gif": "gif", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_SURFACE_ASSET_BYTES = 12_000_000;
const MAX_PUBLISHED_ASSET_CANDIDATES = 64;

export async function uploadSurfaceAsset(input: { DB: RepositoryD1; bucket: R2Like; actorId: string; bytes: ArrayBuffer; claimedContentType: string; at?: Date }) {
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_SURFACE_ASSET_BYTES) throw new Error("surface_asset_size_invalid");
  const user = await input.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(input.actorId).first<{ id: string }>();
  if (!user) throw new Error("surface_asset_owner_forbidden");
  const bytes = new Uint8Array(input.bytes);
  const contentType = detectSurfaceAssetType(bytes);
  if (contentType !== input.claimedContentType.toLowerCase().split(";", 1)[0].trim()) throw new Error("surface_asset_signature_mismatch");
  const sha256 = await hexDigest(bytes);
  const ownerDigest = await hexDigest(new TextEncoder().encode(`${input.actorId}\0${sha256}`));
  const id = `asset_${ownerDigest.slice(0, 32)}`;
  const objectKey = `surface-assets/${input.actorId}/${sha256}.${EXTENSION[contentType]}`;
  validateSurfaceAsset({ objectKey, contentType, byteSize: bytes.byteLength });
  await input.bucket.put(objectKey, input.bytes, { httpMetadata: { contentType } });
  await input.DB.prepare("INSERT INTO surface_assets (id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(id, input.actorId, objectKey, contentType, bytes.byteLength, sha256, (input.at ?? new Date()).getTime()).run();
  const stored = await input.DB.prepare("SELECT id FROM surface_assets WHERE id=? AND owner_user_id=? AND object_key=? AND content_type=? AND byte_size=? AND sha256=? AND deleted_at IS NULL")
    .bind(id, input.actorId, objectKey, contentType, bytes.byteLength, sha256).first();
  if (!stored) throw new Error("surface_asset_conflict");
  return { id, src: `/api/surface-assets/${input.actorId}/${sha256}.${EXTENSION[contentType]}`, contentType, byteSize: bytes.byteLength, sha256 };
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
  const object = await input.bucket.get(objectKey);
  if (!object?.arrayBuffer) return privateNotFound();
  return new Response(await object.arrayBuffer(), { status: 200, headers: surfaceAssetResponseHeaders(row.contentType) });
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

async function hexDigest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function privateNotFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404, headers: { "cache-control": "private, no-store", vary: "Cookie, Authorization" } });
}
