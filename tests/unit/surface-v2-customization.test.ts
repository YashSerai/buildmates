import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_QUALITY_BINDINGS, PROFILE_FIXTURE_BINDINGS, PROFILE_V2_FIXTURES, SurfaceRendererCore,
  safeParseSurfaceSpec, surfaceSpecSchema, type SurfaceNodeV2, type SurfaceSpecV2,
} from "@buildmates/surfaces";

function walk(node: SurfaceNodeV2): SurfaceNodeV2[] {
  const nodes = [node];
  if ("children" in node) for (const child of node.children) nodes.push(...walk(child));
  return nodes;
}

function structuralSignature(spec: SurfaceSpecV2): string {
  return walk(spec.root).map((node) => {
    if (node.type === "section") return `section:${node.layout}:${node.minHeight}:${node.background}`;
    if (node.type === "canvas") return `canvas:${node.rows}:${node.minHeight}`;
    if (node.type === "layer") return `layer:${node.placement.desktop.columnStart}/${node.placement.desktop.columnSpan}:${node.placement.phone.order}`;
    if (node.type === "project-list") return `projects:${node.layout}:${node.columns}`;
    if (node.type === "featured-project") return `featured:${node.layout}:${node.index}`;
    if (node.type === "project-artifact") return `artifact:${node.variant}:${node.index}`;
    if (node.type === "gallery") return `gallery:${node.layout}:${node.columns}`;
    return node.type;
  }).join("|");
}

function normalized(spec: SurfaceSpecV2): SurfaceSpecV2 {
  return {
    ...structuredClone(spec),
    theme: {
      ...structuredClone(spec.theme),
      colors: structuredClone(PROFILE_V2_FIXTURES[0].theme.colors),
      typography: structuredClone(PROFILE_V2_FIXTURES[0].theme.typography),
      atmosphere: { motif: "none", density: "quiet", tone: "accent", continuity: "page" },
    },
  };
}

describe("SurfaceSpec v2 customization ceiling", () => {
  it("validates six full-page profile concepts against realistic binding payloads", () => {
    expect(PROFILE_V2_FIXTURES).toHaveLength(6);
    for (const spec of PROFILE_V2_FIXTURES) {
      const result = surfaceSpecSchema.safeParse(spec);
      if (!result.success) throw new Error(`${spec.title}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    }
  });

  it("keeps six distinct compositions after palette, fonts, and atmosphere are normalized", () => {
    const normalizedFixtures = PROFILE_V2_FIXTURES.map(normalized);
    normalizedFixtures.forEach((spec) => expect(safeParseSurfaceSpec(spec).success).toBe(true));
    expect(new Set(normalizedFixtures.map(structuralSignature)).size).toBe(6);
  });

  it("provides at least four first-viewport silhouettes and four project compositions", () => {
    const silhouettes = PROFILE_V2_FIXTURES.map((spec) => {
      const first = walk(spec.root).slice(0, 8);
      return first.map((node) => node.type === "section" ? `${node.type}:${node.layout}` : node.type).join("/");
    });
    expect(new Set(silhouettes).size).toBeGreaterThanOrEqual(4);
    const projectCompositions = PROFILE_V2_FIXTURES.map((spec) => walk(spec.root).filter((node) => node.type === "project-list" || node.type === "featured-project").map((node) => node.type === "project-list" ? `${node.type}:${node.layout}` : `${node.type}:${node.layout}`).join("/"));
    expect(new Set(projectCompositions).size).toBeGreaterThanOrEqual(4);
  });

  it("encodes distinct phone reading orders while preserving semantic DOM content", () => {
    const mobileSignatures = PROFILE_V2_FIXTURES.map((spec) => {
      const nodes = walk(spec.root);
      const layers = nodes.filter((node): node is Extract<SurfaceNodeV2, { type: "layer" }> => node.type === "layer");
      return layers.length ? layers.map((node) => node.placement.phone.order).join(",") : nodes.slice(0, 10).map((node) => node.type).join(",");
    });
    expect(new Set(mobileSignatures).size).toBeGreaterThanOrEqual(3);
    for (const spec of PROFILE_V2_FIXTURES) expect(walk(spec.root).filter((node) => node.type === "heading" && node.level === 1)).toHaveLength(1);
  });

  it("renders every concept with trusted bindings, approved assets, responsive classes, and no active generated content", () => {
    for (const spec of PROFILE_V2_FIXTURES) {
      const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec, bindings: PROFILE_FIXTURE_BINDINGS, onAction: () => undefined }));
      expect(html).toMatch(/Mira Chen|Yash Serai/);
      expect(html).toContain("surface-v2");
      expect(html).toContain("@container");
      expect(html).toContain("prefers-reduced-motion");
      expect(html).not.toMatch(/<script|<form|<input|<button[^>]*>[^<]*(?:Override|Publish as)/i);
      expect(html).not.toContain("https://");
    }
  });

  it("renders trusted action labels only and drops unapproved media references", () => {
    const spec = PROFILE_V2_FIXTURES[0];
    const trusted = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec, bindings: PROFILE_FIXTURE_BINDINGS, onAction: () => undefined }));
    expect(trusted).toContain(">Connect<");
    expect(trusted).toContain(">Follow public work<");
    const hostileBindings = { ...PROFILE_FIXTURE_BINDINGS, "profile.hero": { assetId: "asset_attacker", alt: "tracking pixel" } };
    const blocked = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec, bindings: hostileBindings }));
    expect(blocked).not.toContain("asset_attacker");
    expect(blocked).not.toContain("tracking pixel");
    expect(blocked).toContain("Media unavailable");
  });

  it("keeps layout bounds and motion static fallback in trusted CSS", () => {
    const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: PROFILE_V2_FIXTURES[0], bindings: PROFILE_FIXTURE_BINDINGS }));
    expect(html).toContain("grid-template-columns:repeat(12,minmax(0,1fr))");
    expect(html).toContain(".surface-grid-align-start{align-items:start}");
    expect(html).toContain(".surface-grid-align-end{align-items:end}");
    expect(html).toContain("overflow:hidden");
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("animation:none!important");
    expect(html).not.toMatch(/100vw|position:fixed|javascript:/i);
  });

  it("keeps muted copy readable when a callout owns its dark tone", () => {
    const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: PROFILE_V2_FIXTURES[0], bindings: PROFILE_FIXTURE_BINDINGS }));
    expect(html).toContain(".surface-callout.surface-tone-secondary p");
    expect(html).toContain(".surface-callout.surface-tone-ink p");
  });

  it("reclaims phone reading width from editorial gutters and desktop-scale display treatments", () => {
    const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: PROFILE_V2_FIXTURES[0], bindings: PROFILE_FIXTURE_BINDINGS }));
    expect(html).toContain(".surface-projects-editorial .surface-project{grid-template-columns:1.75rem minmax(0,1fr)");
    expect(html).toContain(".surface-callout-manifesto{padding:1.25rem;font-size:1.05rem}");
    expect(html).toContain(".surface-project-artifact-stacked-planes .surface-project-artifact-title{font-size:clamp(2.2rem,12cqw,3.5rem)}");
  });

  it("renders a multi-section portfolio with differentiated project artifacts and no absent-project dead space", () => {
    const atlas = PROFILE_V2_FIXTURES[5];
    const html = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: atlas, bindings: PORTFOLIO_QUALITY_BINDINGS }));
    expect(walk(atlas.root).filter((node) => node.type === "section")).toHaveLength(7);
    expect(new Set(walk(atlas.root).filter((node) => node.type === "project-artifact").map((node) => node.type === "project-artifact" ? node.variant : ""))).toEqual(new Set(["orbit-map", "stacked-planes", "type-field", "signal-path"]));
    for (const project of ["Buildmates", "Soulspace", "Safari Gigs", "AfterYou"]) expect(html).toContain(project);
    const missing = renderToStaticMarkup(createElement(SurfaceRendererCore, { spec: atlas, bindings: { ...PORTFOLIO_QUALITY_BINDINGS, "profile.projects": [] } }));
    expect(missing).not.toContain("surface-project-artifact-empty");
  });
});
