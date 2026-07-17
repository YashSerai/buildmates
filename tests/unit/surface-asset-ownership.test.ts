import { describe, expect, it } from "vitest";
import { asUserId, type ProfileId } from "@buildmates/domain";
import { createMemoryRepositories } from "@buildmates/database";
import { DESIGN_POLICY_ID, DESIGN_POLICY_VERSION, seedDesignPolicy, type SurfaceSpec } from "@buildmates/surfaces";

describe("Surface revision asset ownership", () => {
  it("rejects an otherwise valid spec that claims another user's asset", async () => {
    const repositories = createMemoryRepositories();
    const alice = asUserId("surface_asset_alice");
    const bob = asUserId("surface_asset_bob");
    const now = new Date("2026-07-16T00:00:00Z");
    await repositories.users.create({ id: alice, status: "active", operatorRole: "none", createdAt: now });
    await repositories.users.create({ id: bob, status: "active", operatorRole: "none", createdAt: now });
    await repositories.profiles.create({ actorId: bob, id: "profile_surface_asset_bob" as ProfileId, userId: bob, handle: "asset-bob", displayName: "Bob", summary: "Bob's profile", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" });
    await seedDesignPolicy(repositories);
    await repositories.surfaces.addAsset({
      actorId: alice,
      id: "asset_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ownerUserId: alice,
      objectKey: `surface-assets/${alice}/${"a".repeat(64)}.png`,
      contentType: "image/png",
      byteSize: 128,
      sha256: "a".repeat(64),
      at: now,
    });
    await repositories.surfaces.createSurface({ actorId: bob, id: "surface_asset_bob", ownerUserId: bob, kind: "profile", subjectId: "profile_surface_asset_bob", at: now });

    const src = `/api/surface-assets/${alice}/${"a".repeat(64)}.png`;
    const spec: SurfaceSpec = {
      schemaVersion: "1", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "Bob",
      theme: { mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
      root: { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "surface.title", fallback: "Builder" }, { id: "image", type: "media", binding: "surface.image", altBinding: "surface.alt", aspect: "square" }] },
      bindingManifest: { content: [{ key: "surface.title", type: "text" }, { key: "surface.alt", type: "text" }], media: [{ key: "surface.image", altKey: "surface.alt", approvedAssetIds: ["asset_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] }] },
      approvedAssets: [{ id: "asset_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", src }], decorativeRegions: [],
      responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" }, accessibility: { label: "Bob's profile", primaryHeadingNodeId: "title", reducedMotion: "required" },
    };

    await expect(repositories.surfaces.createRevision({ actorId: bob, id: "revision_asset_bob", surfaceId: "surface_asset_bob", authorUserId: bob, revisionNumber: 1, baseRevisionNumber: null, designPolicyId: DESIGN_POLICY_ID, designPolicyVersion: DESIGN_POLICY_VERSION, specJson: JSON.stringify(spec), createdAt: now })).rejects.toThrow("surface_asset_not_owned");
  });
});
