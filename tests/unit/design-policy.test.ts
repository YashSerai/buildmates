import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createMemoryRepositories } from "@buildmates/database";
import { DESIGN_POLICY_SOURCE, DESIGN_POLICY_SOURCE_HASH, HISTORICAL_DESIGN_POLICY_SOURCE, HISTORICAL_DESIGN_POLICY_SOURCE_HASH, PREVIOUS_DESIGN_POLICY_SOURCE, PREVIOUS_DESIGN_POLICY_SOURCE_HASH, SurfaceRendererCore, designPolicy, seedDesignPolicy } from "@buildmates/surfaces";

describe("runtime design policy", () => {
  it("has a deterministic source hash and immutable runtime authority", () => {
    expect(createHash("sha256").update(DESIGN_POLICY_SOURCE).digest("hex")).toBe(DESIGN_POLICY_SOURCE_HASH);
    expect(createHash("sha256").update(PREVIOUS_DESIGN_POLICY_SOURCE).digest("hex")).toBe(PREVIOUS_DESIGN_POLICY_SOURCE_HASH);
    expect(createHash("sha256").update(HISTORICAL_DESIGN_POLICY_SOURCE).digest("hex")).toBe(HISTORICAL_DESIGN_POLICY_SOURCE_HASH);
    expect(designPolicy.authority.generatedCodeMustNever.join(" ")).toContain("execute JavaScript");
  });
  it("seeds the exact active policy idempotently and rejects a conflicting rewrite", async () => {
    const repositories = createMemoryRepositories();
    await seedDesignPolicy(repositories);
    await seedDesignPolicy(repositories);
    await expect(repositories.surfaces.createPolicy({ id: designPolicy.id, version: designPolicy.version, sourceHash: "0".repeat(64), policyJson: "{}", activatedAt: new Date("2026-07-14T00:00:00Z"), at: new Date("2026-07-14T00:00:00Z") })).rejects.toThrow("policy_conflict");
  });
  it("renders a trusted fallback for a malformed spec", () => {
    const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: { schemaVersion: "1", root: { type: "script" } }, bindings: {} }));
    expect(html).toContain("This surface could not be displayed");
    expect(html).not.toContain("script");
  });
  it("renders a trusted fallback for hostile depth without overflowing", () => {
    let hostile: unknown = null;
    for (let depth = 0; depth < 3_000; depth++) hostile = { child: hostile };
    let html = "";
    expect(() => { html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: hostile, bindings: {} })); }).not.toThrow();
    expect(html).toContain("This surface could not be displayed");
  });
  it("continues rendering a registered historical policy version", () => {
    const historical = {
      schemaVersion: "1", designPolicyVersion: "2026-07-14.1", kind: "profile", title: "Historical surface",
      theme: { mode: "light", colors: { canvas: "#ffffff", surface: "#f8f8f4", ink: "#171814", mutedInk: "#55584f", accent: "#cad7ad", accentInk: "#181b12", rule: "#c4c6bd", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
      root: { id: "root", type: "section", tone: "canvas", children: [{ id: "title", type: "heading", level: 1, binding: "profile.name", fallback: "Historical builder" }] },
      bindingManifest: { content: [{ key: "profile.name", type: "text" }], media: [] }, approvedAssets: [], decorativeRegions: [],
      responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" }, accessibility: { label: "Historical builder", primaryHeadingNodeId: "title", reducedMotion: "required" },
    };
    const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: historical, bindings: { "profile.name": "Ada" } }));
    expect(html).toContain("Ada");
    expect(html).not.toContain("could not be displayed");
  });
  it("renders trusted fallback shells for getter and Proxy traps", () => {
    const stateful: Record<string, unknown> = { schemaVersion: "1" };
    let reads = 0;
    Object.defineProperty(stateful, "designPolicyVersion", { enumerable: true, get() { if (++reads === 1) return designPolicy.version; throw new Error("stateful_getter_trap"); } });
    const hostileProxy = new Proxy({}, { ownKeys() { throw new Error("proxy_own_keys_trap"); } });
    for (const hostile of [stateful, hostileProxy]) {
      let html = "";
      expect(() => { html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: hostile, bindings: {} })); }).not.toThrow();
      expect(html).toContain("This surface could not be displayed");
    }
  });
});
