import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUserId, type ProfileId } from "@buildmates/domain";
import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import {
  associateProfileProjectMedia,
  listApprovedProfileMedia,
  listApprovedProfileProjects,
  uploadSurfaceAsset,
} from "../../apps/web/src/platform/surface-assets";
import { applyD1Migrations } from "../helpers/migrate-d1";

describe("structured profile project media", () => {
  let mf: Miniflare;
  let db: D1Database;
  let bucket: R2Bucket;
  const alice = asUserId("profile_media_alice");
  const bob = asUserId("profile_media_bob");
  const now = Date.parse("2026-07-18T12:00:00Z");

  beforeAll(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], r2Buckets: ["ASSETS"], compatibilityDate: "2026-05-22" });
    db = await mf.getD1Database("DB") as D1Database;
    bucket = await mf.getR2Bucket("ASSETS") as R2Bucket;
    await applyD1Migrations(db);
    const repositories = createD1Repositories(db as unknown as RepositoryD1);
    await repositories.users.create({ id: alice, status: "active", operatorRole: "none", createdAt: new Date(now) });
    await repositories.users.create({ id: bob, status: "active", operatorRole: "none", createdAt: new Date(now) });
    await repositories.profiles.create({ actorId: alice, id: "profile-media-draft" as ProfileId, userId: alice, handle: "media-draft", displayName: "Media Draft", summary: "A structured profile", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" });
    await repositories.profiles.create({ actorId: bob, id: "profile-media-bob" as ProfileId, userId: bob, handle: "media-bob", displayName: "Media Bob", summary: "Another profile", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" });
    await db.prepare("INSERT INTO profile_fields(profile_id,field_key,value_json,audience,allow_matching,source_status,provenance,updated_at) VALUES('profile-media-draft','projects',?,'public',1,'confirmed','codex_summary',?),('profile-media-bob','projects',?,'public',1,'confirmed','codex_summary',?)")
      .bind(JSON.stringify([{ id: "buildmates", title: "Buildmates", summary: "A builder network", tags: [], metrics: [] }]), now, JSON.stringify([{ id: "other", title: "Other", summary: "Another project" }]), now).run();
  }, 30_000);

  afterAll(async () => mf.dispose());

  it("binds only a sanitized owner asset to an exact approved project and revokes it with project visibility", async () => {
    await expect(listApprovedProfileProjects({ DB: db as unknown as RepositoryD1, actorId: alice })).resolves.toEqual([{ key: "buildmates", title: "Buildmates" }]);
    const asset = await uploadSurfaceAsset({ DB: db as unknown as RepositoryD1, bucket, actorId: alice, bytes: validPng(), claimedContentType: "image/png" });
    await expect(associateProfileProjectMedia({ DB: db as unknown as RepositoryD1, actorId: alice, assetId: asset.id, projectKey: "buildmates", projectTitle: "Stale title", altText: "Dark product interface" })).rejects.toThrow("profile_project_not_approved");
    await expect(associateProfileProjectMedia({ DB: db as unknown as RepositoryD1, actorId: bob, assetId: asset.id, projectKey: "other", projectTitle: "Other", altText: "Borrowed image" })).rejects.toThrow("surface_asset_not_owned");
    await expect(associateProfileProjectMedia({ DB: db as unknown as RepositoryD1, actorId: alice, assetId: asset.id, projectKey: "buildmates", projectTitle: "Buildmates", altText: "Dark Buildmates product interface" }))
      .resolves.toMatchObject({ assetId: asset.id, projectId: "buildmates", projectTitle: "Buildmates" });
    await expect(listApprovedProfileMedia({ DB: db as unknown as RepositoryD1, actorId: alice })).resolves.toEqual([
      expect.objectContaining({ assetId: asset.id, projectId: "buildmates", projectTitle: "Buildmates", altText: "Dark Buildmates product interface" }),
    ]);
    await db.prepare("UPDATE profile_fields SET audience='private' WHERE profile_id='profile-media-draft' AND field_key='projects'").run();
    await expect(listApprovedProfileMedia({ DB: db as unknown as RepositoryD1, actorId: alice })).resolves.toEqual([]);
    await db.prepare("UPDATE profile_fields SET audience='public',source_status='generated' WHERE profile_id='profile-media-draft' AND field_key='projects'").run();
    await expect(listApprovedProfileProjects({ DB: db as unknown as RepositoryD1, actorId: alice })).resolves.toEqual([]);
    await expect(listApprovedProfileMedia({ DB: db as unknown as RepositoryD1, actorId: alice })).resolves.toEqual([]);
  });
});

function validPng(): ArrayBuffer {
  return Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")).buffer;
}
