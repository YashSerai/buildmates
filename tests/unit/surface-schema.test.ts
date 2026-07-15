import { describe, expect, it } from "vitest";
import { DESIGN_POLICY_VERSION, safeParseSurfaceSpec, surfaceSpecSchema, type SurfaceSpec } from "@buildmates/surfaces";

function minimalSpec(): SurfaceSpec {
  return {
    schemaVersion: "1", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "A safe surface",
    theme: { mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
    root: { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "profile.name", fallback: "Builder" }, { id: "body", type: "text", style: "body", binding: "profile.summary", fallback: "No summary" }] },
    bindingManifest: { content: [{ key: "profile.name", type: "text" }, { key: "profile.summary", type: "text" }], media: [] }, approvedAssets: [],
    decorativeRegions: [], responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" },
    accessibility: { label: "Builder surface", primaryHeadingNodeId: "title", reducedMotion: "required" },
  };
}

describe("SurfaceSpec", () => {
  it("accepts a strict trusted component tree", () => expect(surfaceSpecSchema.parse(minimalSpec())).toEqual(minimalSpec()));
  it("dispatches historical specs by policy version and fails closed for unknown versions", () => {
    const historical = { ...minimalSpec(), designPolicyVersion: "2026-07-14.1" };
    expect(safeParseSurfaceSpec(historical).success).toBe(true);
    expect(safeParseSurfaceSpec(historical, "2026-07-14.1").success).toBe(true);
    expect(safeParseSurfaceSpec({ ...historical, designPolicyVersion: "2099-01-01.1" }).success).toBe(false);
    expect(safeParseSurfaceSpec(historical, DESIGN_POLICY_VERSION).success).toBe(false);
  });
  it("rejects unknown fields and an untrusted component type", () => {
    expect(surfaceSpecSchema.safeParse({ ...minimalSpec(), script: "alert(1)" }).success).toBe(false);
    const unsafe = structuredClone(minimalSpec()) as unknown as Record<string, unknown>;
    (unsafe.root as { children: unknown[] }).children.push({ id: "x", type: "raw-html", html: "<script>" });
    expect(surfaceSpecSchema.safeParse(unsafe).success).toBe(false);
  });
  it("requires one addressable primary heading", () => {
    const spec = minimalSpec();
    spec.accessibility.primaryHeadingNodeId = "missing";
    expect(surfaceSpecSchema.safeParse(spec).success).toBe(false);
  });
  it("rejects duplicate ids and missing decorative region references", () => {
    const spec = minimalSpec();
    spec.root = { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "profile.name", fallback: "Builder" }, { id: "title", type: "decorative-region", regionId: "missing", height: "medium" }] };
    const result = surfaceSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message).join(" ")).toMatch(/Duplicate|Missing/);
  });
  it("caps recursive depth", () => {
    const spec = minimalSpec();
    let node = spec.root;
    for (let index = 0; index < 13; index++) {
      const child = { id: `stack-${index}`, type: "stack" as const, gap: "sm" as const, align: "start" as const, children: [] };
      if ("children" in node) node.children = [child];
      node = child;
    }
    node.children = [{ id: "title", type: "heading", level: 1, binding: "profile.name", fallback: "Builder" }];
    expect(surfaceSpecSchema.safeParse(spec).success).toBe(false);
  });
  it("rejects hostile object depth without throwing a RangeError", () => {
    let hostile: unknown = null;
    for (let depth = 0; depth < 3_000; depth++) hostile = { child: hostile };
    let result: ReturnType<typeof surfaceSpecSchema.safeParse> | undefined;
    expect(() => { result = surfaceSpecSchema.safeParse(hostile); }).not.toThrow();
    expect(result?.success).toBe(false);
  });
  it("is exception-total for stateful getters and throwing Proxy traps", () => {
    const stateful = minimalSpec() as unknown as Record<string, unknown>;
    let reads = 0;
    Object.defineProperty(stateful, "designPolicyVersion", { enumerable: true, get() { if (++reads === 1) return DESIGN_POLICY_VERSION; throw new Error("stateful_getter_trap"); } });
    let getterResult: ReturnType<typeof safeParseSurfaceSpec> | undefined;
    expect(() => { getterResult = safeParseSurfaceSpec(stateful); }).not.toThrow();
    expect(getterResult?.success).toBe(false);

    const hostileProxy = new Proxy({}, { ownKeys() { throw new Error("proxy_own_keys_trap"); } });
    let proxyResult: ReturnType<typeof safeParseSurfaceSpec> | undefined;
    expect(() => { proxyResult = safeParseSurfaceSpec(hostileProxy); }).not.toThrow();
    expect(proxyResult?.success).toBe(false);
  });
  it("rejects heading skips, undeclared bindings, weak contrast, and unapproved media", () => {
    const heading = minimalSpec();
    if ("children" in heading.root) heading.root.children.push({ id: "skip", type: "heading", level: 3, binding: "profile.summary", fallback: "Skipped" });
    expect(surfaceSpecSchema.safeParse(heading).success).toBe(false);
    const binding = minimalSpec();
    binding.bindingManifest.content = binding.bindingManifest.content.filter((item) => item.key !== "profile.summary");
    expect(surfaceSpecSchema.safeParse(binding).success).toBe(false);
    const contrast = minimalSpec();
    contrast.theme.colors.mutedInk = "#dddddd";
    expect(surfaceSpecSchema.safeParse(contrast).success).toBe(false);
    const media = minimalSpec();
    media.bindingManifest.content.push({ key: "profile.alt", type: "text" });
    media.bindingManifest.media.push({ key: "profile.hero", altKey: "profile.alt", approvedAssetIds: ["asset_not_allowed"] });
    expect(surfaceSpecSchema.safeParse(media).success).toBe(false);
  });
  it("rejects a 1:1 muted-on-accent pairing that trusted accent sections can render", () => {
    const spec = minimalSpec();
    spec.theme.colors.accent = spec.theme.colors.mutedInk;
    const result = surfaceSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toContain("Accent muted text contrast must be at least 4.5:1");
  });
  it("rejects focus tokens that cannot form a visible two-tone ring", () => {
    const spec = minimalSpec();
    spec.theme.colors.focusInner = "#777777";
    spec.theme.colors.focusOuter = "#777777";
    const result = surfaceSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toContain("Focus rings must contrast with each other by at least 3:1");
  });
  it("rejects generated action labels so semantics retain trusted server copy", () => {
    const spec = minimalSpec() as unknown as Record<string, unknown>;
    const root = spec.root as { children: unknown[] };
    root.children.push({ id: "danger", type: "action-row", actions: [{ id: "fake", action: "report", label: "Connect" }] });
    expect(surfaceSpecSchema.safeParse(spec).success).toBe(false);
  });
});
