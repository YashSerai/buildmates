import { describe, expect, it } from "vitest";
import {
  DESIGN_POLICY_VERSION, PREVIOUS_DESIGN_POLICY_VERSION, safeParseSurfaceSpec,
  surfaceSpecSchema, type SurfaceNodeV2, type SurfaceSpecV1, type SurfaceSpecV2,
} from "@buildmates/surfaces";

function minimalSpec(): SurfaceSpecV2 {
  return {
    schemaVersion: "2", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "A safe surface",
    theme: {
      mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", secondary: "#24251f", secondaryInk: "#ffffff", highlight: "#f6c445", highlightInk: "#171814", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" },
      typography: { display: "book-serif", body: "warm-grotesk", data: "engine-mono", scale: "comfortable", headingWeight: "bold", headingCase: "as-written", letterSpacing: "tight" },
      shape: { corners: "soft", density: "comfortable", border: "hairline" }, atmosphere: { motif: "none", density: "quiet", tone: "accent", continuity: "page" }, motion: { preset: "none", durationMs: 1_000, iterations: 1 },
    },
    root: section([{ id: "title", type: "heading", level: 1, binding: "profile.name", fallback: "Builder", size: "display", align: "start", width: "full", weight: "bold", lineHeight: "tight", tracking: "tight" }, textNode("body", "profile.summary")]),
    bindingManifest: { content: [{ key: "profile.name", type: "text" }, { key: "profile.summary", type: "text" }], media: [] }, approvedAssets: [], decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
    accessibility: { label: "Builder surface", primaryHeadingNodeId: "title", reducedMotion: "required" },
  };
}

function section(children: SurfaceNodeV2[]): SurfaceNodeV2 {
  return { id: "root", type: "section", tone: "canvas", layout: "flow", padding: "md", bleed: false, minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center", children };
}
function textNode(id: string, binding: string): SurfaceNodeV2 {
  return { id, type: "text", style: "body", binding, fallback: "No summary", align: "start", width: "prose", weight: "regular", lineHeight: "relaxed", tracking: "normal" };
}
function priorV1Spec(): SurfaceSpecV1 {
  return {
    schemaVersion: "1", designPolicyVersion: PREVIOUS_DESIGN_POLICY_VERSION, kind: "profile", title: "Prior surface",
    theme: { mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
    root: { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "profile.name", fallback: "Builder" }] },
    bindingManifest: { content: [{ key: "profile.name", type: "text" }], media: [] }, approvedAssets: [], decorativeRegions: [], responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" }, accessibility: { label: "Prior surface", primaryHeadingNodeId: "title", reducedMotion: "required" },
  };
}

describe("SurfaceSpec", () => {
  it("accepts an active v2 trusted component tree", () => expect(surfaceSpecSchema.parse(minimalSpec())).toEqual(minimalSpec()));

  it("reads exact v1 policies but never accepts v1 under the active v2 policy", () => {
    const prior = priorV1Spec();
    expect(safeParseSurfaceSpec(prior).success).toBe(true);
    expect(safeParseSurfaceSpec(prior, PREVIOUS_DESIGN_POLICY_VERSION, { forRevisionCreation: true }).success).toBe(true);
    expect(safeParseSurfaceSpec({ ...prior, designPolicyVersion: DESIGN_POLICY_VERSION }).success).toBe(false);
    expect(safeParseSurfaceSpec({ ...prior, designPolicyVersion: "2099-01-01.1" }).success).toBe(false);
  });

  it("rejects unknown fields, raw HTML, scripts, forms, arbitrary CSS, and generated action labels", () => {
    expect(surfaceSpecSchema.safeParse({ ...minimalSpec(), script: "alert(1)" }).success).toBe(false);
    for (const unsafeNode of [
      { id: "x", type: "raw-html", html: "<script>alert(1)</script>" },
      { id: "x", type: "form", action: "https://attacker.example" },
      { id: "x", type: "frame", css: "position:fixed;inset:0" },
      { id: "x", type: "action-slot", placement: "hero", actions: [{ id: "fake", action: "report", label: "Connect" }] },
    ]) {
      const unsafe = structuredClone(minimalSpec()) as unknown as Record<string, unknown>;
      (unsafe.root as { children: unknown[] }).children.push(unsafeNode);
      expect(surfaceSpecSchema.safeParse(unsafe).success).toBe(false);
    }
  });

  it("bounds responsive placement and requires canvas children to be governed layers", () => {
    const spec = minimalSpec();
    spec.root = section([{ id: "canvas", type: "canvas", columns: 12, rows: 4, gap: "sm", minHeight: "short", clip: true, children: [textNode("loose", "profile.summary")] }]);
    expect(surfaceSpecSchema.safeParse(spec).success).toBe(false);
    const placed = minimalSpec();
    placed.root = section([{ id: "canvas", type: "canvas", columns: 12, rows: 4, gap: "sm", minHeight: "short", clip: true, children: [{ id: "layer", type: "layer", overlap: "none", placement: { desktop: { columnStart: 12, columnSpan: 2, rowStart: 1, rowSpan: 1, order: 0, align: "start", offsetX: "none", offsetY: "none" }, tablet: { columnStart: 1, columnSpan: 12, rowStart: 1, rowSpan: 1, order: 0, align: "start", offsetX: "none", offsetY: "none" }, phone: { columnStart: 1, columnSpan: 12, rowStart: 1, rowSpan: 1, order: 0, align: "start", offsetX: "none", offsetY: "none" } }, children: [textNode("placed-text", "profile.summary")] }] }]);
    expect(surfaceSpecSchema.safeParse(placed).success).toBe(false);
  });

  it("requires Codex-authorized media declarations and forbids remote asset/background URLs", () => {
    const spec = minimalSpec();
    spec.bindingManifest.content.push({ key: "profile.alt", type: "text" });
    spec.bindingManifest.media.push({ key: "profile.hero", altKey: "profile.alt", approvedAssetIds: ["asset_fixture_hero"], authorization: "surface-approved" });
    spec.approvedAssets.push({ id: "asset_fixture_hero", src: `/api/surface-assets/fixture/${"a".repeat(64)}.webp` });
    spec.root = section([{ id: "hero", type: "media", binding: "profile.hero", altBinding: "profile.alt", aspect: "landscape", fit: "cover", focalPoint: "center", treatment: "plain" }, spec.root.type === "section" ? spec.root.children[0] : textNode("unused", "profile.summary")]);
    expect(surfaceSpecSchema.safeParse(spec).success).toBe(true);
    const missingAuthorization = structuredClone(spec) as unknown as { bindingManifest: { media: Array<Record<string, unknown>> } };
    delete missingAuthorization.bindingManifest.media[0].authorization;
    expect(surfaceSpecSchema.safeParse(missingAuthorization).success).toBe(false);
    const remote = structuredClone(spec);
    remote.approvedAssets[0].src = "https://attacker.example/track.png";
    expect(surfaceSpecSchema.safeParse(remote).success).toBe(false);
  });

  it("requires one ordered primary heading and declared binding types", () => {
    const missing = minimalSpec(); missing.accessibility.primaryHeadingNodeId = "missing";
    expect(surfaceSpecSchema.safeParse(missing).success).toBe(false);
    const undeclared = minimalSpec(); undeclared.bindingManifest.content = undeclared.bindingManifest.content.filter((item) => item.key !== "profile.summary");
    expect(surfaceSpecSchema.safeParse(undeclared).success).toBe(false);
    const skip = minimalSpec(); if (skip.root.type === "section") skip.root.children.push({ ...textNode("bad", "profile.summary"), type: "heading", level: 3, size: "section", width: "full", weight: "bold", lineHeight: "snug", tracking: "normal", fallback: "Skip" });
    expect(surfaceSpecSchema.safeParse(skip).success).toBe(false);
  });

  it("rejects weak contrast and invisible focus rings", () => {
    const contrast = minimalSpec(); contrast.theme.colors.mutedInk = "#dddddd";
    expect(surfaceSpecSchema.safeParse(contrast).success).toBe(false);
    const focus = minimalSpec(); focus.theme.colors.focusInner = "#777777"; focus.theme.colors.focusOuter = "#777777";
    expect(surfaceSpecSchema.safeParse(focus).success).toBe(false);
  });

  it("caps recursion and is exception-total for hostile values", () => {
    let hostile: unknown = null;
    for (let depth = 0; depth < 3_000; depth++) hostile = { child: hostile };
    expect(() => surfaceSpecSchema.safeParse(hostile)).not.toThrow();
    expect(surfaceSpecSchema.safeParse(hostile).success).toBe(false);
    const proxy = new Proxy({}, { ownKeys() { throw new Error("trap"); } });
    expect(() => safeParseSurfaceSpec(proxy)).not.toThrow();
    expect(safeParseSurfaceSpec(proxy).success).toBe(false);
  });
});
