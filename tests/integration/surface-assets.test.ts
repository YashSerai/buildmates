import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asUserId, type ProfileId } from "@buildmates/domain";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION, seedDesignPolicy, surfaceSpecSchema, SURFACE_POLICY_REGISTRY, type SurfaceSpec } from "@buildmates/surfaces";
import { MAX_SURFACE_ASSET_BYTES, readRequestBodyWithLimit, readSurfaceAsset, uploadSurfaceAsset } from "../../apps/web/src/platform/surface-assets";
import type { R2Like } from "../../apps/web/src/platform/r2";

describe("protected surface asset API service", () => {
  let mf: Miniflare;
  let db: D1Database;
  let bucket: R2Bucket;
  const alice = asUserId("user_asset_alice");
  const bob = asUserId("user_asset_bob");
  const charlie = asUserId("user_asset_charlie");

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], r2Buckets: ["ASSETS"], compatibilityDate: "2026-05-22" });
    db = await mf.getD1Database("DB") as D1Database;
    bucket = await mf.getR2Bucket("ASSETS") as R2Bucket;
    for (const migration of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${migration}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    const repositories = createD1Repositories(db as unknown as RepositoryD1);
    await repositories.users.create({ id: alice, status: "active", operatorRole: "none", createdAt: new Date() });
    await repositories.users.create({ id: bob, status: "active", operatorRole: "none", createdAt: new Date() });
    await repositories.users.create({ id: charlie, status: "active", operatorRole: "none", createdAt: new Date() });
    const historical = SURFACE_POLICY_REGISTRY["2026-07-14.1"];
    await repositories.surfaces.createPolicy({ id: historical.designPolicyId, version: historical.version, sourceHash: historical.sourceHash, policyJson: historical.policyJson, activatedAt: new Date("2026-07-14T00:00:00Z"), at: new Date("2026-07-14T00:00:00Z") });
    await seedDesignPolicy(repositories);
  }, 15_000);
  afterEach(async () => mf.dispose());

  it("uses no-store for every authorized read and revokes anonymous reads immediately", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).buffer;
    const asset = await uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: alice, bytes: png, claimedContentType: "image/png" });
    expect(asset).toMatchObject({ id: expect.stringMatching(/^asset_/), contentType: "image/png", byteSize: 12, src: expect.stringMatching(/^\/api\/surface-assets\/user_asset_alice\//) });
    const filename = asset.src.split("/").at(-1)!;
    const response = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: alice, ownerId: alice, filename });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(png));
    expect((await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: bob, ownerId: alice, filename })).status).toBe(404);

    const repositories = createD1Repositories(db as unknown as RepositoryD1);
    await repositories.profiles.create({ actorId: alice, id: "profile-asset-alice" as ProfileId, userId: alice, handle: "asset-alice", displayName: "Alice", summary: "Public profile", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" });
    await publishAssetSurface("asset-public-surface", "asset-public-revision", "profile", "profile-asset-alice", asset);
    await expect(repositories.surfaces.findRevisionForViewer("asset-public-revision", null)).resolves.not.toBeNull();
    const published = await db.prepare("SELECT r.spec_json AS specJson FROM surface_revisions r JOIN surfaces s ON s.published_revision_id=r.id WHERE r.id='asset-public-revision'").first<{ specJson: string }>();
    expect(surfaceSpecSchema.safeParse(JSON.parse(published!.specJson)).success).toBe(true);
    expect(JSON.parse(published!.specJson).approvedAssets).toContainEqual({ id: asset.id, src: asset.src });
    const anonymousPublic = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: null, ownerId: alice, filename });
    expect(anonymousPublic.status).toBe(200);
    expect(anonymousPublic.headers.get("cache-control")).toBe("private, no-store");
    const authenticatedPublic = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: bob, ownerId: alice, filename });
    expect(authenticatedPublic.status).toBe(200);
    expect(authenticatedPublic.headers.get("cache-control")).toBe("private, no-store");

    await db.prepare("UPDATE profiles SET audience='suggested_connections' WHERE id='profile-asset-alice'").run();
    const privateProfile = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: charlie, ownerId: alice, filename });
    expect(privateProfile.status).toBe(404);
    expect(privateProfile.headers.get("cache-control")).toBe("private, no-store");
    const revokedAnonymous = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: null, ownerId: alice, filename });
    expect(revokedAnonymous.status).toBe(404);
    expect(revokedAnonymous.headers.get("cache-control")).toBe("private, no-store");
    await repositories.profiles.create({ actorId: charlie, id: "profile-asset-charlie" as ProfileId, userId: charlie, handle: "asset-charlie", displayName: "Charlie", summary: "Public but cannot launder another owner's asset", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" });
    await publishAssetSurface("asset-forged-surface", "asset-forged-revision", "profile", "profile-asset-charlie", asset, charlie);
    expect((await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: null, ownerId: alice, filename })).status).toBe(404);

    const now = Date.now();
    await db.prepare("INSERT INTO circles (id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES ('asset-circle','Asset circle','Private members','active','admin',1,?,?)").bind(now, now).run();
    await db.prepare("INSERT INTO circle_memberships (circle_id,user_id,role,status,joined_at) VALUES ('asset-circle',?,'owner','active',?),('asset-circle',?,'member','active',?)").bind(alice, now, bob, now).run();
    await publishAssetSurface("asset-circle-surface", "asset-circle-revision", "circle", "asset-circle", asset);
    const member = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: bob, ownerId: alice, filename });
    expect(member.status).toBe(200);
    expect(member.headers.get("cache-control")).toBe("private, no-store");
    expect((await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: charlie, ownerId: alice, filename })).status).toBe(404);
  }, 15_000);

  it("rejects claimed-type forgery, executable bytes, and unknown owners", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>").buffer;
    await expect(uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: alice, bytes: html, claimedContentType: "image/png" })).rejects.toThrow(/signature/);
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    await expect(uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: alice, bytes: png, claimedContentType: "image/svg+xml" })).rejects.toThrow(/mismatch/);
    await expect(uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: "missing", bytes: png, claimedContentType: "image/png" })).rejects.toThrow(/owner/);
  }, 15_000);

  it("serves a raster referenced by a published historical-policy profile after the active policy is seeded", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).buffer;
    const asset = await uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: alice, bytes: png, claimedContentType: "image/png" });
    const repositories = createD1Repositories(db as unknown as RepositoryD1);
    await repositories.profiles.create({ actorId: alice, id: "profile-asset-historical" as ProfileId, userId: alice, handle: "asset-historical", displayName: "Historical Alice", summary: "Published under policy one", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" });
    const historical = SURFACE_POLICY_REGISTRY["2026-07-14.1"];
    const now = new Date();
    await repositories.surfaces.createSurface({ actorId: alice, id: "asset-historical-surface", ownerUserId: alice, kind: "profile", subjectId: "profile-asset-historical", at: now });
    await repositories.surfaces.createRevision({ actorId: alice, id: "asset-historical-revision", surfaceId: "asset-historical-surface", authorUserId: alice, revisionNumber: 1, baseRevisionNumber: null, designPolicyId: historical.designPolicyId, designPolicyVersion: historical.version, specJson: assetSpecJson("profile", asset, historical.version), createdAt: now });
    await repositories.surfaces.publishRevision({ actorId: alice, surfaceId: "asset-historical-surface", revisionId: "asset-historical-revision", expectedPublishedRevisionNumber: null, governanceVersion: 1, at: now });
    await seedDesignPolicy(repositories);
    const filename = asset.src.split("/").at(-1)!;
    const response = await readSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, viewerId: null, ownerId: alice, filename });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(png));
  });

  it("enforces the byte cap before any database or object-store operation", async () => {
    let touched = false;
    const inertDb = { prepare() { touched = true; throw new Error("unexpected_db_access"); } } as unknown as RepositoryD1;
    const inertBucket = { put: async () => { touched = true; }, get: async () => null, delete: async () => { touched = true; } } satisfies R2Like;
    await expect(uploadSurfaceAsset({ DB: inertDb, bucket: inertBucket, actorId: alice, bytes: new ArrayBuffer(MAX_SURFACE_ASSET_BYTES + 1), claimedContentType: "image/png" })).rejects.toThrow("surface_asset_size_invalid");
    expect(touched).toBe(false);
  });

  it("streams to a hard cap when Content-Length is missing or spoofed low", async () => {
    await expect(readRequestBodyWithLimit(streamingRequest([5, 5]), 8)).rejects.toThrow("surface_asset_size_invalid");
    await expect(readRequestBodyWithLimit(streamingRequest([5, 5], "4"), 8)).rejects.toThrow("surface_asset_size_invalid");
    await expect(readRequestBodyWithLimit(streamingRequest([3, 4], "7"), 8)).resolves.toEqual(Uint8Array.from([1, 1, 1, 2, 2, 2, 2]).buffer);
  });

  it("never deletes a content-addressed object after an ambiguous database failure", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).buffer;
    const existing = await uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: alice, bytes: png, claimedContentType: "image/png" });
    const filename = existing.src.split("/").at(-1)!;
    const objectKey = `surface-assets/${alice}/${filename}`;
    let deleteCalls = 0;
    const guardedBucket: R2Like = {
      put: (key, value, options) => bucket.put(key, value, options),
      get: (key) => bucket.get(key) as unknown as ReturnType<R2Like["get"]>,
      delete: async (key) => { deleteCalls++; await bucket.delete(key); },
    };
    const failingDb = {
      prepare(sql: string) {
        if (sql.startsWith("INSERT INTO surface_assets")) return { bind: () => ({ run: async () => { throw new Error("ambiguous_db_failure"); } }) };
        return db.prepare(sql);
      },
    } as unknown as RepositoryD1;
    await expect(uploadSurfaceAsset({ DB: failingDb, bucket: guardedBucket, actorId: alice, bytes: png, claimedContentType: "image/png" })).rejects.toThrow("ambiguous_db_failure");
    expect(deleteCalls).toBe(0);
    const object = await bucket.get(objectKey);
    expect(object).not.toBeNull();
    expect(new Uint8Array(await object!.arrayBuffer())).toEqual(new Uint8Array(png));
  });

  async function publishAssetSurface(surfaceId: string, revisionId: string, kind: "profile" | "circle", subjectId: string, asset: { id: string; src: string }, ownerId = alice, policy: { designPolicyId: string; version: "2026-07-14.1" | typeof DESIGN_POLICY_VERSION } = { designPolicyId: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION }) {
    const now = Date.now();
    await db.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,published_revision_id,governance_version,created_at,updated_at) VALUES (?,?,?,?,NULL,1,?,?)").bind(surfaceId, ownerId, kind, subjectId, now, now).run();
    await db.prepare("INSERT INTO surface_revisions (id,surface_id,revision_number,base_revision_number,author_user_id,design_policy_id,design_policy_version,spec_json,status,created_at) VALUES (?,?,1,NULL,?,?,?,?, 'published',?)")
      .bind(revisionId, surfaceId, ownerId, policy.designPolicyId, policy.version, assetSpecJson(kind, asset, policy.version), now).run();
    await db.prepare("UPDATE surfaces SET published_revision_id=? WHERE id=?").bind(revisionId, surfaceId).run();
  }
});

function streamingRequest(chunkSizes: number[], contentLength?: string): Request {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunkSizes.length) return controller.close();
      controller.enqueue(new Uint8Array(chunkSizes[index]).fill(index + 1));
      index++;
    },
  });
  const headers = contentLength === undefined ? undefined : { "content-length": contentLength };
  return new Request("https://buildmates.test/api/surface-assets", { method: "POST", body, headers, duplex: "half" } as RequestInit & { duplex: "half" });
}

function assetSpecJson(kind: "profile" | "circle", asset: { id: string; src: string }, policyVersion: "2026-07-14.1" | typeof DESIGN_POLICY_VERSION = DESIGN_POLICY_VERSION): string {
  const spec: SurfaceSpec = {
    schemaVersion: "1", designPolicyVersion: policyVersion, kind, title: "Asset surface",
    theme: { mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
    root: { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "surface.title", fallback: "Surface" }, { id: "hero", type: "media", binding: "surface.hero", altBinding: "surface.alt", aspect: "landscape" }] },
    bindingManifest: { content: [{ key: "surface.title", type: "text" }, { key: "surface.alt", type: "text" }], media: [{ key: "surface.hero", altKey: "surface.alt", approvedAssetIds: [asset.id] }] }, approvedAssets: [{ id: asset.id, src: asset.src }], decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" }, accessibility: { label: "Asset surface", primaryHeadingNodeId: "title", reducedMotion: "required" },
  };
  return JSON.stringify(spec);
}
