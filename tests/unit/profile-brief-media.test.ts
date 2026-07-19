import { describe, expect, it } from "vitest";
import { createProfileGenerationBrief, profileMediaBinding, profileSurfaceMediaIsAuthorized } from "@buildmates/surfaces";

describe("profile Surface media authorization", () => {
  const asset = {
    id: "asset_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    src: `/api/surface-assets/user_alice/${"a".repeat(64)}.png`,
  };
  const binding = profileMediaBinding(asset.id);
  const authorizedMedia = [{ key: binding.key, altKey: binding.altKey, label: "Public project image", approvedAssetIds: [asset.id] }];

  it("returns an exact surface-approved asset contract in the generation brief", () => {
    const brief = createProfileGenerationBrief({
      handle: "alice",
      fields: [
        { key: "profile.displayName", label: "Display name", value: "Alice", bindingType: "text" },
        { key: binding.altKey, label: "Project image description", value: "A public project screenshot", bindingType: "text" },
      ],
      media: authorizedMedia,
      approvedAssets: [asset],
    });
    expect(brief.authorizedMedia).toEqual([{ ...authorizedMedia[0], authorization: "surface-approved" }]);
    expect(brief.approvedAssets).toEqual([asset]);
    expect(brief.authorizedContent[binding.altKey]).toBe("A public project screenshot");
  });

  it("rejects forged paths, unapproved IDs, and unreferenced approved assets", () => {
    const valid = {
      approvedAssets: [asset],
      bindingManifest: { media: [{ key: binding.key, altKey: binding.altKey, approvedAssetIds: [asset.id] }] },
    };
    expect(profileSurfaceMediaIsAuthorized(valid, authorizedMedia, [asset])).toBe(true);
    expect(profileSurfaceMediaIsAuthorized({ ...valid, approvedAssets: [{ ...asset, src: `/api/surface-assets/user_mallory/${"a".repeat(64)}.png` }] }, authorizedMedia, [asset])).toBe(false);
    expect(profileSurfaceMediaIsAuthorized({ ...valid, bindingManifest: { media: [{ ...valid.bindingManifest.media[0], approvedAssetIds: ["asset_mallory00000000"] }] } }, authorizedMedia, [asset])).toBe(false);
    expect(profileSurfaceMediaIsAuthorized({ ...valid, bindingManifest: { media: [] } }, authorizedMedia, [asset])).toBe(false);
  });

  it("carries bounded reference principles without authorizing remote assets or cloning", () => {
    const brief = createProfileGenerationBrief({
      handle: "alice",
      fields: [{ key: "profile.displayName", label: "Display name", value: "Alice", bindingType: "text" }],
      references: [
        { url: "https://recent.design/websites/example#hero", principles: ["Layered editorial depth", "Project chapters with distinct rhythm"] },
        { url: "http://insecure.example", principles: ["Ignore"] },
        { url: "https://linear.app", principles: ["High information density with disciplined hierarchy"] },
      ],
    });
    expect(brief.referenceDirection).toEqual([
      { url: "https://recent.design/websites/example", principles: ["Layered editorial depth", "Project chapters with distinct rhythm"] },
      { url: "https://linear.app/", principles: ["High information density with disciplined hierarchy"] },
    ]);
    expect(brief.instruction).toMatch(/without copying their layout, copy, brand, or assets/i);
    expect(brief.approvedAssets).toEqual([]);
  });
});
