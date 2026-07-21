import { COMPONENT_V2_DESIGN_POLICY_VERSION } from "./design-policy";
import type { SurfaceBindings, SurfaceProject } from "./render";
import type { Placement, SurfaceNodeV2, SurfaceSpecV2 } from "./schema";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);
const assets = [
  { id: "asset_fixture_hero", src: `/api/surface-assets/fixture/${hashA}.webp` },
  { id: "asset_fixture_work", src: `/api/surface-assets/fixture/${hashB}.png` },
  { id: "asset_fixture_field", src: `/api/surface-assets/fixture/${hashC}.jpg` },
] as const;

const contentManifest = [
  { key: "profile.name", type: "text" }, { key: "profile.role", type: "text" },
  { key: "profile.bio", type: "text" }, { key: "profile.note", type: "text" },
  { key: "profile.workHeading", type: "text" }, { key: "profile.approachHeading", type: "text" },
  { key: "profile.quote", type: "text" }, { key: "profile.heroAlt", type: "text" },
  { key: "profile.workAlt", type: "text" }, { key: "profile.fieldAlt", type: "text" },
  { key: "profile.facts", type: "facts" }, { key: "profile.projects", type: "projects" },
  { key: "profile.tags", type: "strings" },
] as const;
const mediaManifest = [
  { key: "profile.hero", altKey: "profile.heroAlt", approvedAssetIds: [assets[0].id], authorization: "surface-approved" },
  { key: "profile.work", altKey: "profile.workAlt", approvedAssetIds: [assets[1].id], authorization: "surface-approved" },
  { key: "profile.field", altKey: "profile.fieldAlt", approvedAssetIds: [assets[2].id], authorization: "surface-approved" },
] as const;

export const PROFILE_FIXTURE_BINDINGS: SurfaceBindings = Object.freeze({
  "profile.name": "Mira Chen",
  "profile.role": "Builder - product systems and applied AI",
  "profile.bio": "I turn ambiguous workflows into small, dependable products. My current work sits between agent tooling, collaboration, and interfaces that explain themselves.",
  "profile.note": "Open to comparing notes with builders working on durable agent products and unusual interaction models.",
  "profile.workHeading": "Selected work",
  "profile.approachHeading": "Build the system, then make it legible.",
  "profile.quote": "The useful thing is usually hiding one layer beneath the obvious interface.",
  "profile.heroAlt": "Mira working beside a wall of product sketches",
  "profile.workAlt": "A close view of a modular workflow prototype",
  "profile.fieldAlt": "Notebook pages and interface studies from field research",
  "profile.hero": { assetId: assets[0].id, alt: "Mira working beside a wall of product sketches" },
  "profile.work": { assetId: assets[1].id, alt: "A close view of a modular workflow prototype" },
  "profile.field": { assetId: assets[2].id, alt: "Notebook pages and interface studies from field research" },
  "profile.facts": [
    { label: "Based in", value: "Vancouver" }, { label: "Building", value: "Agent collaboration tools" },
    { label: "Working style", value: "Prototype, test, explain" }, { label: "Looking for", value: "Peers who ship careful systems" },
  ],
  "profile.tags": ["Applied AI", "Developer tools", "Interaction design", "Research systems", "Small teams"],
  "profile.projects": [
    { id: "project-orbit", title: "Orbit Notes", summary: "A working memory surface that keeps decisions attached to the work that produced them.", href: "/projects/orbit-notes", tags: ["Agents", "Memory"], metrics: [{ label: "Stage", value: "Private beta" }, { label: "Focus", value: "Decision trails" }] },
    { id: "project-fieldkit", title: "Fieldkit", summary: "A compact research tool for turning observations into testable product questions.", href: "/projects/fieldkit", tags: ["Research", "Workflow"], metrics: [{ label: "Stage", value: "Prototype" }, { label: "Mode", value: "Local-first" }] },
    { id: "project-relay", title: "Relay", summary: "A handoff format for people and agents that preserves intent without dragging along an entire transcript.", href: "/projects/relay", tags: ["Collaboration", "Context"], metrics: [{ label: "Stage", value: "Exploring" }] },
  ] satisfies readonly SurfaceProject[],
});

export const PORTFOLIO_QUALITY_BINDINGS: SurfaceBindings = Object.freeze({
  ...PROFILE_FIXTURE_BINDINGS,
  "profile.name": "Yash Serai",
  "profile.role": "Product builder · AI-native systems · Vancouver",
  "profile.bio": "I build AI-native products and Codex-directed workflows focused on real human connection, reliable automation, and thoughtful product experiences.",
  "profile.note": "Current work spans builder networks, social products, consumer products, marketplaces, and the systems that help them ship.",
  "profile.workHeading": "A portfolio of living systems",
  "profile.approachHeading": "From rough idea to working product.",
  "profile.quote": "Direct, evidence-led, product-specific, and focused on complete working systems.",
  "profile.facts": [
    { label: "Current focus", value: "AI-native products" }, { label: "Based in", value: "Vancouver" },
    { label: "Working mode", value: "Build, test, refine" }, { label: "Interested in", value: "Builders shipping thoughtful systems" },
  ],
  "profile.tags": ["Product systems", "Codex", "MCP", "Automation", "Social products", "Production reliability"],
  "profile.projects": [
    { id: "project-buildmates", title: "Buildmates", summary: "A Codex-native builder network that helps people meet through the work they are doing now, not a static list of credentials.", href: "/projects/buildmates", tags: ["Builder network", "Codex", "MCP"], metrics: [{ label: "Stage", value: "Building" }, { label: "Focus", value: "Human connection" }] },
    { id: "project-soulspace", title: "Soulspace", summary: "A social product centered on real human connection and thoughtful product experiences.", href: "/projects/soulspace", tags: ["Social product", "Connection"], metrics: [{ label: "Stage", value: "Building" }, { label: "Mode", value: "Product system" }] },
    { id: "project-safari-gigs", title: "Safari Gigs", summary: "A shipped marketplace product supported by a Codex-directed system for running its marketing work.", href: "/projects/safari-gigs", tags: ["Marketplace", "Automation"], metrics: [{ label: "Stage", value: "Shipped" }, { label: "System", value: "Marketing workflow" }] },
    { id: "project-afteryou", title: "AfterYou", summary: "A shipped consumer product in Yash's active portfolio of relationship-centered ideas.", href: "/projects/afteryou", tags: ["Consumer product", "Relationships"], metrics: [{ label: "Stage", value: "Shipped" }] },
  ] satisfies readonly SurfaceProject[],
});

const palette = {
  canvas: "#fffdf7", surface: "#f1eee4", ink: "#171814", mutedInk: "#55584f",
  accent: "#cad7ad", accentInk: "#181b12", secondary: "#24251f", secondaryInk: "#ffffff",
  highlight: "#f6c445", highlightInk: "#171814", rule: "#aaa99f", focusInner: "#000000", focusOuter: "#ffffff",
} as const;

function theme(display: "book-serif" | "gallery-serif" | "poster-condensed" | "warm-grotesk" | "engine-mono" | "sturdy-slab", motif: "none" | "orbit" | "thread" | "registration" | "constellation" | "contour"): SurfaceSpecV2["theme"] {
  return {
    mode: "light", colors: palette,
    typography: { display, body: "warm-grotesk", data: "engine-mono", scale: "comfortable", headingWeight: "bold", headingCase: "as-written", letterSpacing: "tight" },
    shape: { corners: "soft", density: "comfortable", border: "hairline" },
    atmosphere: { motif, density: "present", tone: "highlight", continuity: "page" },
    motion: { preset: "drift", durationMs: 8_000, iterations: 2 },
  };
}

function heading(id: string, level: 1 | 2 | 3 | 4, binding: string, fallback: string, size: "hero" | "display" | "section" | "subsection" = "section", align: "start" | "center" | "end" = "start"): SurfaceNodeV2 {
  return { id, type: "heading", level, binding, fallback, size, align, width: size === "hero" ? "balanced" : "full", weight: size === "hero" ? "black" : "bold", lineHeight: size === "hero" ? "tight" : "snug", tracking: "tight" };
}
function text(id: string, binding: string, fallback: string, style: "body" | "lead" | "caption" | "data" | "eyebrow" | "quote" = "body", align: "start" | "center" | "end" = "start"): SurfaceNodeV2 {
  return { id, type: "text", style, binding, fallback, align, width: style === "lead" ? "narrow" : "prose", weight: style === "eyebrow" ? "bold" : "regular", lineHeight: style === "quote" ? "snug" : "relaxed", tracking: style === "eyebrow" ? "wide" : "normal" };
}
function stack(id: string, children: SurfaceNodeV2[], gap: "sm" | "md" | "lg" | "xl" = "md"): SurfaceNodeV2 {
  return { id, type: "stack", gap, align: "start", justify: "start", width: "full", children };
}
function container(id: string, children: SurfaceNodeV2[], width: "narrow" | "standard" | "wide" | "full" = "wide"): SurfaceNodeV2 {
  return { id, type: "container", width, align: "center", padding: "none", children };
}
function section(id: string, children: SurfaceNodeV2[], options: Partial<Extract<SurfaceNodeV2, { type: "section" }>> = {}): SurfaceNodeV2 {
  return { id, type: "section", tone: "canvas", layout: "flow", padding: "lg", bleed: true, minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center", children, ...options };
}
function media(id: string, binding: "profile.hero" | "profile.work" | "profile.field", aspect: "portrait" | "landscape" | "square" | "panoramic" | "auto", treatment: "plain" | "framed" | "offset" | "monochrome" = "plain"): SurfaceNodeV2 {
  const altBinding = binding === "profile.hero" ? "profile.heroAlt" : binding === "profile.work" ? "profile.workAlt" : "profile.fieldAlt";
  return { id, type: "media", binding, altBinding, aspect, fit: "cover", focalPoint: "center", treatment };
}
function place(columnStart: number, columnSpan: number, rowStart: number, rowSpan: number, order: number, align: Placement["align"] = "stretch"): Placement {
  return { columnStart, columnSpan, rowStart, rowSpan, order, align, offsetX: "none", offsetY: "none" };
}
function layer(id: string, children: SurfaceNodeV2[], desktop: Placement, tablet: Placement, phone: Placement, overlap: "none" | "soft" | "strong" = "none"): SurfaceNodeV2 {
  return { id, type: "layer", placement: { desktop, tablet, phone }, overlap, children };
}
function base(title: string, display: Parameters<typeof theme>[0], motif: Parameters<typeof theme>[1], root: SurfaceNodeV2): SurfaceSpecV2 {
  return {
    schemaVersion: "2", designPolicyVersion: COMPONENT_V2_DESIGN_POLICY_VERSION, kind: "profile", title, theme: theme(display, motif), root,
    bindingManifest: { content: [...contentManifest], media: mediaManifest.map((item) => ({ ...item, approvedAssetIds: [...item.approvedAssetIds] })) }, approvedAssets: [...assets], decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "full", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
    accessibility: { label: title, primaryHeadingNodeId: `${title.toLowerCase().replace(/[^a-z]+/g, "-")}-title`, reducedMotion: "required" },
  };
}

const orbitalTitleId = "orbital-builder-title";
export const ORBITAL_BUILDER_PROFILE = base("Orbital builder", "gallery-serif", "orbit", section("orbital-root", [
  container("orbital-container", [
    { id: "orbital-canvas", type: "canvas", columns: 12, rows: 12, gap: "md", minHeight: "viewport", clip: true, children: [
      layer("orbital-copy-layer", [stack("orbital-copy", [text("orbital-role", "profile.role", "Builder", "eyebrow"), heading(orbitalTitleId, 1, "profile.name", "Builder", "hero"), text("orbital-bio", "profile.bio", "Building useful systems.", "lead"), { id: "orbital-actions", type: "action-slot", placement: "hero", actions: [{ id: "orbital-follow", action: "follow" }, { id: "orbital-connect", action: "connect" }] }], "lg")], place(1, 8, 2, 8, 1, "center"), place(1, 8, 1, 7, 1), place(1, 12, 1, 1, 1)),
      layer("orbital-image-layer", [media("orbital-hero-image", "profile.hero", "portrait", "offset")], place(8, 5, 1, 11, 2), place(8, 5, 2, 9, 2), place(2, 10, 1, 1, 3), "soft"),
      layer("orbital-motif-layer", [{ id: "orbital-line", type: "motif-line", path: "loop", weight: "regular", tone: "highlight", span: "cross-section" }, { id: "orbital-mark", type: "decorative-mark", mark: "orbit", size: "xl", position: "inline", tone: "accent" }], place(2, 10, 9, 3, 3), place(1, 12, 9, 3, 3), place(1, 12, 1, 1, 2), "strong"),
    ] },
  ], "full"),
  { id: "orbital-project-line", type: "motif-line", path: "arc", weight: "hairline", tone: "highlight", span: "cross-section" },
  { id: "orbital-project-one", type: "featured-project", binding: "profile.projects", index: 0, layout: "media-left", showTags: true, showMetrics: true },
  { id: "orbital-project-two", type: "featured-project", binding: "profile.projects", index: 1, layout: "media-right", showTags: true, showMetrics: true },
], { layout: "hero", padding: "none", minHeight: "viewport", background: "spotlight" }));

const editorialTitleId = "editorial-research-index-title";
export const EDITORIAL_RESEARCH_PROFILE = base("Editorial research index", "book-serif", "thread", section("editorial-root", [container("editorial-container", [stack("editorial-stack", [
  text("editorial-kicker", "profile.role", "Independent builder", "eyebrow"), heading(editorialTitleId, 1, "profile.name", "Builder", "display"),
  { id: "editorial-rule", type: "divider", style: "stamp" },
  { id: "editorial-intro", type: "split", ratio: "1-2", gap: "xl", align: "start", reverseOnMobile: true, children: [{ id: "editorial-facts", type: "fact-list", binding: "profile.facts", emptyMessage: "Details coming soon", layout: "rail", emphasis: "quiet" }, text("editorial-bio", "profile.bio", "Building useful systems.", "lead")] },
  heading("editorial-projects-title", 2, "profile.note", "Selected work", "subsection"), { id: "editorial-projects", type: "project-list", binding: "profile.projects", emptyMessage: "Projects coming soon", layout: "editorial", columns: 1 },
], "lg")], "standard")], { background: "paper-rule" }));

const journalTitleId = "field-journal-title";
export const FIELD_JOURNAL_PROFILE = base("Field journal", "warm-grotesk", "contour", section("journal-root", [
  container("journal-container", [stack("journal-stack", [text("journal-role", "profile.role", "Builder", "eyebrow"), heading(journalTitleId, 1, "profile.name", "Builder", "hero"), text("journal-bio", "profile.bio", "Building useful systems.", "lead")], "lg")], "wide"),
  { id: "journal-gallery", type: "gallery", layout: "masonry", columns: 3, treatment: "framed", items: [{ binding: "profile.hero", altBinding: "profile.heroAlt" }, { binding: "profile.work", altBinding: "profile.workAlt" }, { binding: "profile.field", altBinding: "profile.fieldAlt" }] },
  container("journal-lower", [stack("journal-lower-stack", [heading("journal-projects-title", 2, "profile.note", "Field notes", "section"), { id: "journal-projects", type: "project-list", binding: "profile.projects", emptyMessage: "Projects coming soon", layout: "featured", columns: 1 }], "lg")]),
], { layout: "cover", padding: "lg", background: "wash", backgroundMediaBinding: "profile.field", backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "right" }));

const collageTitleId = "maker-collage-title";
export const MAKER_COLLAGE_PROFILE = base("Maker collage", "sturdy-slab", "registration", section("collage-root", [container("collage-container", [
  { id: "collage-canvas", type: "canvas", columns: 12, rows: 12, gap: "sm", minHeight: "tall", clip: true, children: [
    layer("collage-title-layer", [{ id: "collage-title-frame", type: "frame", tone: "accent", padding: "lg", border: "strong", elevation: "directional", rotation: "left", span: 1, children: [heading(collageTitleId, 1, "profile.name", "Builder", "display"), text("collage-role", "profile.role", "Builder", "eyebrow")] }], place(1, 7, 2, 5, 1), place(1, 8, 2, 5, 1), place(1, 12, 1, 1, 1), "strong"),
    layer("collage-image-a", [media("collage-work", "profile.work", "square", "offset")], place(8, 5, 1, 6, 2), place(8, 5, 1, 6, 2), place(2, 9, 1, 1, 3), "soft"),
    layer("collage-image-b", [media("collage-field", "profile.field", "landscape", "monochrome")], place(2, 6, 7, 5, 3), place(1, 7, 7, 5, 3), place(1, 12, 1, 1, 2), "strong"),
    layer("collage-note", [{ id: "collage-note-frame", type: "frame", tone: "secondary", padding: "md", border: "strong", elevation: "tonal", rotation: "right", span: 1, children: [text("collage-note-text", "profile.quote", "A note from the builder.", "quote")] }], place(8, 4, 7, 4, 4), place(8, 5, 7, 4, 4), place(1, 12, 1, 1, 4), "strong"),
  ] },
  { id: "collage-project", type: "featured-project", binding: "profile.projects", index: 2, layout: "artifact", showTags: true, showMetrics: true },
], "full")], { background: "registration" }));

const ledgerTitleId = "data-ledger-title";
export const DATA_LEDGER_PROFILE = base("Data ledger", "poster-condensed", "none", section("ledger-root", [container("ledger-container", [stack("ledger-stack", [
  { id: "ledger-header", type: "grid", columns: 2, layout: "sidebar-left", gap: "lg", align: "start", children: [text("ledger-role", "profile.role", "Builder", "data"), heading(ledgerTitleId, 1, "profile.name", "Builder", "hero", "end")] },
  { id: "ledger-divider", type: "divider", style: "accent" }, { id: "ledger-facts", type: "fact-list", binding: "profile.facts", emptyMessage: "No ledger entries", layout: "inline", emphasis: "strong" },
  { id: "ledger-tags", type: "tag-list", binding: "profile.tags", emptyMessage: "No tags", style: "boxed" }, heading("ledger-projects-title", 2, "profile.note", "Work ledger", "subsection"),
  { id: "ledger-projects", type: "project-list", binding: "profile.projects", emptyMessage: "No projects", layout: "cards", columns: 3 }, { id: "ledger-actions", type: "action-slot", placement: "footer", actions: [{ id: "ledger-follow", action: "follow" }] },
], "lg")], "wide")], { tone: "surface", background: "solid" }));

const atlasTitleId = "working-atlas-title";
const atlasRoot = section("atlas-root", [
  section("atlas-hero", [container("atlas-hero-container", [
    { id: "atlas-hero-canvas", type: "canvas", columns: 12, rows: 12, gap: "md", minHeight: "viewport", clip: true, children: [
      layer("atlas-hero-copy-layer", [stack("atlas-hero-copy", [text("atlas-role", "profile.role", "Product builder", "eyebrow"), heading(atlasTitleId, 1, "profile.name", "Builder", "hero"), text("atlas-bio", "profile.bio", "Building complete product systems.", "lead"), { id: "atlas-actions", type: "action-slot", placement: "hero", actions: [{ id: "atlas-connect", action: "connect" }, { id: "atlas-follow", action: "follow" }] }], "lg")], place(1, 6, 2, 9, 1, "center"), place(1, 7, 1, 8, 1), place(1, 12, 1, 1, 1)),
      layer("atlas-hero-artifact-layer", [{ id: "atlas-hero-artifact", type: "project-artifact", binding: "profile.projects", index: 0, variant: "orbit-map", tone: "secondary", scale: "hero" }], place(7, 6, 1, 12, 2), place(7, 6, 2, 10, 2), place(1, 12, 1, 1, 2), "strong"),
      layer("atlas-hero-mark-layer", [{ id: "atlas-hero-mark", type: "decorative-mark", mark: "bracket", size: "lg", position: "inline", tone: "highlight" }], place(6, 2, 10, 2, 3), place(5, 3, 10, 2, 3), place(1, 12, 1, 1, 3), "soft"),
    ] },
  ], "full")], { tone: "ink", layout: "hero", padding: "none", minHeight: "viewport", background: "spotlight" }),
  section("atlas-intro", [container("atlas-intro-container", [
    { id: "atlas-intro-grid", type: "split", ratio: "1-2", gap: "2xl", align: "start", reverseOnMobile: false, children: [
      stack("atlas-intro-meta", [text("atlas-index-label", "profile.role", "Builder", "data"), { id: "atlas-facts", type: "fact-list", binding: "profile.facts", emptyMessage: "Details coming soon", layout: "rail", emphasis: "quiet" }], "lg"),
      stack("atlas-intro-copy", [heading("atlas-work-title", 2, "profile.workHeading", "Selected work", "display"), text("atlas-note", "profile.note", "Current work and projects.", "lead"), { id: "atlas-tags", type: "tag-list", binding: "profile.tags", emptyMessage: "Interests coming soon", style: "plain" }], "lg"),
    ] },
  ], "wide")], { padding: "xl", background: "paper-rule" }),
  section("atlas-project-one", [container("atlas-project-one-container", [
    { id: "atlas-project-one-split", type: "split", ratio: "3-2", gap: "xl", align: "stretch", reverseOnMobile: false, children: [
      { id: "atlas-project-one-artifact", type: "project-artifact", binding: "profile.projects", index: 1, variant: "stacked-planes", tone: "accent", scale: "large" },
      stack("atlas-project-one-copy", [text("atlas-project-one-label", "profile.workHeading", "Selected work", "eyebrow"), { id: "atlas-project-one-detail", type: "featured-project", binding: "profile.projects", index: 1, layout: "media-left", showTags: true, showMetrics: true }], "md"),
    ] },
  ], "wide")], { tone: "surface", padding: "xl", background: "solid" }),
  section("atlas-project-two", [container("atlas-project-two-container", [
    { id: "atlas-project-two-split", type: "split", ratio: "2-3", gap: "xl", align: "stretch", reverseOnMobile: true, children: [
      stack("atlas-project-two-copy", [text("atlas-project-two-label", "profile.role", "Product builder", "eyebrow"), { id: "atlas-project-two-detail", type: "featured-project", binding: "profile.projects", index: 2, layout: "media-right", showTags: true, showMetrics: true }], "md"),
      { id: "atlas-project-two-artifact", type: "project-artifact", binding: "profile.projects", index: 2, variant: "type-field", tone: "accent", scale: "large" },
    ] },
  ], "wide")], { tone: "canvas", padding: "xl", background: "wash" }),
  section("atlas-project-three", [container("atlas-project-three-container", [
    { id: "atlas-project-three-artifact", type: "project-artifact", binding: "profile.projects", index: 3, variant: "signal-path", tone: "canvas", scale: "hero" },
    { id: "atlas-project-three-detail", type: "featured-project", binding: "profile.projects", index: 3, layout: "poster", showTags: true, showMetrics: true },
  ], "wide")], { tone: "secondary", padding: "xl", background: "registration" }),
  section("atlas-close", [container("atlas-close-container", [
    { id: "atlas-close-split", type: "split", ratio: "2-1", gap: "2xl", align: "end", reverseOnMobile: false, children: [heading("atlas-approach-title", 2, "profile.approachHeading", "From idea to working product.", "display"), stack("atlas-close-note", [text("atlas-quote", "profile.quote", "Focused on complete working systems.", "quote"), { id: "atlas-footer-actions", type: "action-slot", placement: "footer", actions: [{ id: "atlas-footer-connect", action: "connect" }] }], "lg")] },
  ], "wide")], { tone: "accent", padding: "2xl", background: "solid" }),
], { padding: "none", bleed: true, background: "solid" });

const atlasTheme = theme("gallery-serif", "orbit");
export const WORKING_ATLAS_PROFILE: SurfaceSpecV2 = {
  ...base("Working atlas", "gallery-serif", "orbit", atlasRoot),
  theme: {
    ...atlasTheme,
    mode: "dark",
    colors: { canvas: "#f2efe7", surface: "#d7d8ce", ink: "#101815", mutedInk: "#344039", accent: "#b8ca9b", accentInk: "#101810", secondary: "#0f1917", secondaryInk: "#f4f0e6", highlight: "#e66d32", highlightInk: "#15130f", rule: "#788079", focusInner: "#ffffff", focusOuter: "#0f1917" },
    typography: { ...atlasTheme.typography, scale: "cinematic", headingWeight: "black" },
    shape: { corners: "square", density: "spacious", border: "strong" },
    atmosphere: { motif: "orbit", density: "bold", tone: "highlight", continuity: "page" },
    motion: { preset: "drift", durationMs: 10_000, iterations: 2 },
  },
};

export const PROFILE_V2_FIXTURES = Object.freeze([
  ORBITAL_BUILDER_PROFILE, EDITORIAL_RESEARCH_PROFILE, FIELD_JOURNAL_PROFILE, MAKER_COLLAGE_PROFILE, DATA_LEDGER_PROFILE, WORKING_ATLAS_PROFILE,
]);
