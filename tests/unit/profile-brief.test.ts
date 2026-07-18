import { describe, expect, it } from "vitest";
import { createProfileGenerationBrief } from "@buildmates/surfaces";

describe("profile generation brief", () => {
  it("contains only explicitly authorized content bindings", () => {
    const brief = createProfileGenerationBrief({ handle: "ada", fields: [{ key: "profile.name", label: "Name", value: "Ada", bindingType: "text" }] });
    expect(brief.authorizedContent).toEqual({ "profile.name": "Ada" });
    expect(brief.schemaVersion).toBe("2");
    expect(JSON.stringify(brief)).not.toContain("hidden");
  });

  it("authorizes media only when its alt binding and identity-bound asset are both approved", () => {
    const src = `/api/surface-assets/ada/${"a".repeat(64)}.webp`;
    const brief = createProfileGenerationBrief({
      handle: "ada",
      fields: [{ key: "profile.heroAlt", label: "Hero description", value: "Ada at work", bindingType: "text" }],
      media: [
        { key: "profile.hero", label: "Hero image", altKey: "profile.heroAlt", approvedAssetIds: ["asset_approved_hero"] },
        { key: "profile.tracker", label: "Tracker", altKey: "private.alt", approvedAssetIds: ["asset_approved_hero"] },
      ],
      approvedAssets: [{ id: "asset_approved_hero", src }, { id: "asset_remote_bad", src: "https://attacker.example/tracker.png" }],
    });
    expect(brief.authorizedMedia).toEqual([{ key: "profile.hero", label: "Hero image", altKey: "profile.heroAlt", approvedAssetIds: ["asset_approved_hero"], authorization: "surface-approved" }]);
    expect(brief.approvedAssets).toEqual([{ id: "asset_approved_hero", src }]);
    expect(JSON.stringify(brief)).not.toContain("attacker.example");
    expect(JSON.stringify(brief)).not.toContain("private.alt");
  });
});
