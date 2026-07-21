import { z } from "zod";
import {
  DESIGN_POLICY_ID,
  DESIGN_POLICY_SOURCE,
  DESIGN_POLICY_SOURCE_HASH,
  DESIGN_POLICY_VERSION,
  HISTORICAL_DESIGN_POLICY_ID,
  HISTORICAL_DESIGN_POLICY_SOURCE,
  HISTORICAL_DESIGN_POLICY_SOURCE_HASH,
  HISTORICAL_DESIGN_POLICY_VERSION,
  LEGACY_V2_DESIGN_POLICY_ID,
  LEGACY_V2_DESIGN_POLICY_SOURCE,
  LEGACY_V2_DESIGN_POLICY_SOURCE_HASH,
  LEGACY_V2_DESIGN_POLICY_VERSION,
  PREVIOUS_DESIGN_POLICY_ID,
  PREVIOUS_DESIGN_POLICY_SOURCE,
  PREVIOUS_DESIGN_POLICY_SOURCE_HASH,
  PREVIOUS_DESIGN_POLICY_VERSION,
  PRIOR_ACTIVE_DESIGN_POLICY_ID,
  PRIOR_ACTIVE_DESIGN_POLICY_SOURCE,
  PRIOR_ACTIVE_DESIGN_POLICY_SOURCE_HASH,
  PRIOR_ACTIVE_DESIGN_POLICY_VERSION,
  COMPONENT_V2_DESIGN_POLICY_ID,
  COMPONENT_V2_DESIGN_POLICY_SOURCE,
  COMPONENT_V2_DESIGN_POLICY_SOURCE_HASH,
  COMPONENT_V2_DESIGN_POLICY_VERSION,
  PROFILE_V3_DESIGN_POLICY_ID,
  PROFILE_V3_DESIGN_POLICY_SOURCE,
  PROFILE_V3_DESIGN_POLICY_SOURCE_HASH,
  PROFILE_V3_DESIGN_POLICY_VERSION,
} from "./design-policy";
import { validateGeneratedSiteSource } from "./generated-site";

const idSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/i);
const bindingSchema = z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/i);
const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const spacingSchema = z.enum(["none", "xs", "sm", "md", "lg", "xl", "2xl"]);
const legacySpacingSchema = z.enum(["none", "xs", "sm", "md", "lg", "xl"]);
const alignSchema = z.enum(["start", "center", "end"]);
const justifySchema = z.enum(["start", "center", "end", "between"]);
const assetIdSchema = z.string().regex(/^asset_[a-z0-9_-]{8,80}$/i);
const actionSchema = z.enum(["connect", "follow", "report", "privacy", "navigate"]);
export const SURFACE_FONT_REGISTRY = Object.freeze({
  "book-serif": "Charter, Bitstream Charter, Cambria, Georgia, serif",
  "gallery-serif": "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif",
  "poster-condensed": "Arial Narrow, Roboto Condensed, Impact, sans-serif",
  "warm-grotesk": "Avenir Next, Avenir, Segoe UI, system-ui, sans-serif",
  "engine-mono": "Cascadia Mono, Consolas, monospace",
  "sturdy-slab": "Rockwell, Roboto Slab, Georgia, serif",
} as const);
const fontIdSchema = z.enum(Object.keys(SURFACE_FONT_REGISTRY) as [keyof typeof SURFACE_FONT_REGISTRY, ...(keyof typeof SURFACE_FONT_REGISTRY)[]]);

const legacySurfaceThemeSchema = z.object({
  mode: z.enum(["light", "dark"]),
  colors: z.object({
    canvas: hexColorSchema, surface: hexColorSchema, ink: hexColorSchema,
    mutedInk: hexColorSchema, accent: hexColorSchema, accentInk: hexColorSchema,
    rule: hexColorSchema, focusInner: hexColorSchema, focusOuter: hexColorSchema,
  }).strict(),
  typography: z.object({
    display: z.enum(["editorial", "humanist", "technical"]),
    body: z.enum(["humanist", "neutral"]),
    scale: z.enum(["compact", "comfortable", "generous"]),
  }).strict(),
  shape: z.object({
    corners: z.enum(["square", "soft", "rounded"]),
    density: z.enum(["compact", "comfortable", "spacious"]),
  }).strict(),
}).strict();

export const surfaceThemeSchema = z.object({
  mode: z.enum(["light", "dark"]),
  colors: z.object({
    canvas: hexColorSchema, surface: hexColorSchema, ink: hexColorSchema,
    mutedInk: hexColorSchema, accent: hexColorSchema, accentInk: hexColorSchema,
    secondary: hexColorSchema, secondaryInk: hexColorSchema,
    highlight: hexColorSchema, highlightInk: hexColorSchema,
    rule: hexColorSchema, focusInner: hexColorSchema, focusOuter: hexColorSchema,
  }).strict(),
  typography: z.object({
    display: fontIdSchema,
    body: fontIdSchema,
    data: fontIdSchema,
    scale: z.enum(["compact", "comfortable", "generous", "cinematic"]),
    headingWeight: z.enum(["light", "regular", "bold", "black"]),
    headingCase: z.enum(["as-written", "uppercase"]),
    letterSpacing: z.enum(["tight", "normal", "wide"]),
  }).strict(),
  shape: z.object({
    corners: z.enum(["square", "soft", "rounded"]),
    density: z.enum(["compact", "comfortable", "spacious"]),
    border: z.enum(["none", "hairline", "strong"]),
  }).strict(),
  atmosphere: z.object({
    motif: z.enum(["none", "orbit", "thread", "registration", "constellation", "contour"]),
    density: z.enum(["quiet", "present", "bold"]),
    tone: z.enum(["accent", "secondary", "highlight", "ink"]),
    continuity: z.enum(["section", "page"]),
  }).strict(),
  motion: z.object({ preset: z.enum(["none", "drift", "pulse", "parallax-hint"]), durationMs: z.number().int().min(400).max(12_000), iterations: z.number().int().min(1).max(3) }).strict(),
}).strict();

const baseNode = z.object({ id: idSchema }).strict();

export type SurfaceNodeV1 =
  | { id: string; type: "section"; tone: "canvas" | "surface" | "accent"; children: SurfaceNodeV1[] }
  | { id: string; type: "stack"; gap: z.infer<typeof legacySpacingSchema>; align: z.infer<typeof alignSchema>; children: SurfaceNodeV1[] }
  | { id: string; type: "grid"; columns: 1 | 2 | 3; gap: z.infer<typeof legacySpacingSchema>; children: SurfaceNodeV1[] }
  | { id: string; type: "heading"; level: 1 | 2 | 3 | 4; binding: string; fallback: string }
  | { id: string; type: "text"; style: "body" | "lead" | "caption" | "data"; binding: string; fallback: string }
  | { id: string; type: "fact-list"; binding: string; emptyMessage: string }
  | { id: string; type: "project-list"; binding: string; emptyMessage: string }
  | { id: string; type: "media"; binding: string; altBinding: string; aspect: "portrait" | "landscape" | "square" }
  | { id: string; type: "callout"; titleBinding: string; bodyBinding: string }
  | { id: string; type: "action-row"; actions: Array<{ id: string; action: z.infer<typeof actionSchema>; supportingCopy?: string }> }
  | { id: string; type: "decorative-region"; regionId: string; height: "short" | "medium" | "tall" };

export type SurfaceNodeV2 =
  | { id: string; type: "section"; tone: "canvas" | "surface" | "accent" | "secondary" | "ink"; layout: "flow" | "hero" | "band" | "cover"; padding: z.infer<typeof spacingSchema>; bleed: boolean; minHeight: "auto" | "half" | "viewport"; background: "solid" | "wash" | "spotlight" | "paper-rule" | "registration"; backgroundMediaBinding: string | null; backgroundMediaOpacity: "subtle" | "medium" | "strong"; backgroundMediaFocalPoint: "center" | "top" | "bottom" | "left" | "right"; children: SurfaceNodeV2[] }
  | { id: string; type: "container"; width: "narrow" | "standard" | "wide" | "full"; align: "start" | "center" | "end"; padding: z.infer<typeof spacingSchema>; children: SurfaceNodeV2[] }
  | { id: string; type: "canvas"; columns: 12; rows: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12; gap: z.infer<typeof spacingSchema>; minHeight: "short" | "medium" | "tall" | "viewport"; clip: boolean; children: SurfaceNodeV2[] }
  | { id: string; type: "layer"; placement: ResponsivePlacement; overlap: "none" | "soft" | "strong"; children: SurfaceNodeV2[] }
  | { id: string; type: "stack"; gap: z.infer<typeof spacingSchema>; align: z.infer<typeof alignSchema>; justify: z.infer<typeof justifySchema>; width: "auto" | "prose" | "wide" | "full"; children: SurfaceNodeV2[] }
  | { id: string; type: "grid"; columns: 1 | 2 | 3 | 4; layout: "equal" | "feature-left" | "feature-right" | "sidebar-left" | "sidebar-right"; gap: z.infer<typeof spacingSchema>; align: "start" | "center" | "stretch"; children: SurfaceNodeV2[] }
  | { id: string; type: "split"; ratio: "1-1" | "2-3" | "3-2" | "1-2" | "2-1"; gap: z.infer<typeof spacingSchema>; align: "start" | "center" | "end" | "stretch"; reverseOnMobile: boolean; children: [SurfaceNodeV2, SurfaceNodeV2] }
  | { id: string; type: "cluster"; gap: z.infer<typeof spacingSchema>; align: z.infer<typeof alignSchema>; justify: z.infer<typeof justifySchema>; children: SurfaceNodeV2[] }
  | { id: string; type: "frame"; tone: "transparent" | "canvas" | "surface" | "accent" | "secondary" | "ink"; padding: z.infer<typeof spacingSchema>; border: "none" | "hairline" | "strong"; elevation: "none" | "directional" | "tonal"; rotation: "none" | "left" | "right"; span: 1 | 2 | 3 | 4; children: SurfaceNodeV2[] }
  | { id: string; type: "heading"; level: 1 | 2 | 3 | 4; binding: string; fallback: string; size: "hero" | "display" | "section" | "subsection"; align: z.infer<typeof alignSchema>; width: "tight" | "balanced" | "full"; weight: "light" | "regular" | "bold" | "black"; lineHeight: "tight" | "snug" | "normal"; tracking: "tight" | "normal" | "wide" }
  | { id: string; type: "text"; style: "body" | "lead" | "caption" | "data" | "eyebrow" | "quote"; binding: string; fallback: string; align: z.infer<typeof alignSchema>; width: "prose" | "narrow" | "full"; weight: "regular" | "medium" | "bold"; lineHeight: "tight" | "snug" | "normal" | "relaxed"; tracking: "tight" | "normal" | "wide" }
  | { id: string; type: "fact-list"; binding: string; emptyMessage: string; layout: "grid" | "inline" | "rail"; emphasis: "quiet" | "strong" }
  | { id: string; type: "tag-list"; binding: string; emptyMessage: string; style: "plain" | "boxed" | "stamp" }
  | { id: string; type: "project-list"; binding: string; emptyMessage: string; layout: "cards" | "editorial" | "featured"; columns: 1 | 2 | 3 }
  | { id: string; type: "featured-project"; binding: string; index: number; layout: "media-left" | "media-right" | "poster" | "artifact"; showTags: boolean; showMetrics: boolean }
  | { id: string; type: "project-artifact"; binding: string; index: number; variant: "orbit-map" | "type-field" | "signal-path" | "stacked-planes"; tone: "canvas" | "surface" | "accent" | "secondary" | "ink"; scale: "medium" | "large" | "hero" }
  | { id: string; type: "media"; binding: string; altBinding: string; aspect: "portrait" | "landscape" | "square" | "panoramic" | "auto"; fit: "cover" | "contain"; focalPoint: "center" | "top" | "bottom" | "left" | "right"; treatment: "plain" | "framed" | "offset" | "monochrome" }
  | { id: string; type: "gallery"; items: Array<{ binding: string; altBinding: string }>; layout: "grid" | "filmstrip" | "masonry"; columns: 2 | 3 | 4; treatment: "plain" | "framed" | "offset" | "monochrome" }
  | { id: string; type: "callout"; titleBinding: string; bodyBinding: string; variant: "note" | "manifesto" | "quote"; tone: "surface" | "accent" | "secondary" | "ink" }
  | { id: string; type: "divider"; style: "solid" | "dashed" | "accent" | "stamp" }
  | { id: string; type: "spacer"; size: "xs" | "sm" | "md" | "lg" | "xl" }
  | { id: string; type: "decorative-mark"; mark: "circle" | "cross" | "star" | "orbit" | "checker" | "bracket"; size: "sm" | "md" | "lg" | "xl"; position: "inline" | "top-left" | "top-right" | "bottom-left" | "bottom-right"; tone: "accent" | "secondary" | "highlight" | "ink" }
  | { id: string; type: "motif-line"; path: "arc" | "loop" | "diagonal" | "meander"; weight: "hairline" | "regular" | "bold"; tone: "accent" | "secondary" | "highlight" | "ink"; span: "local" | "section" | "cross-section" }
  | { id: string; type: "action-row"; actions: Array<{ id: string; action: z.infer<typeof actionSchema>; supportingCopy?: string }> }
  | { id: string; type: "action-slot"; placement: "hero" | "inline" | "footer"; actions: Array<{ id: string; action: z.infer<typeof actionSchema>; supportingCopy?: string }> }
  | { id: string; type: "decorative-region"; regionId: string; height: "short" | "medium" | "tall" | "viewport" };

export type SurfaceNode = SurfaceNodeV1 | SurfaceNodeV2;

export type ResponsivePlacement = {
  desktop: Placement;
  tablet: Placement;
  phone: Placement;
};
export type Placement = { columnStart: number; columnSpan: number; rowStart: number; rowSpan: number; order: number; align: "start" | "center" | "end" | "stretch"; offsetX: "none" | "inset" | "outset"; offsetY: "none" | "up" | "down" };

const legacySurfaceNodeSchema: z.ZodType<SurfaceNodeV1> = z.lazy(() => z.discriminatedUnion("type", [
  baseNode.extend({ type: z.literal("section"), tone: z.enum(["canvas", "surface", "accent"]), children: z.array(legacySurfaceNodeSchema).max(40) }).strict(),
  baseNode.extend({ type: z.literal("stack"), gap: legacySpacingSchema, align: alignSchema, children: z.array(legacySurfaceNodeSchema).max(40) }).strict(),
  baseNode.extend({ type: z.literal("grid"), columns: z.union([z.literal(1), z.literal(2), z.literal(3)]), gap: legacySpacingSchema, children: z.array(legacySurfaceNodeSchema).max(24) }).strict(),
  baseNode.extend({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), binding: bindingSchema, fallback: z.string().max(160) }).strict(),
  baseNode.extend({ type: z.literal("text"), style: z.enum(["body", "lead", "caption", "data"]), binding: bindingSchema, fallback: z.string().max(320) }).strict(),
  baseNode.extend({ type: z.literal("fact-list"), binding: bindingSchema, emptyMessage: z.string().max(160) }).strict(),
  baseNode.extend({ type: z.literal("project-list"), binding: bindingSchema, emptyMessage: z.string().max(160) }).strict(),
  baseNode.extend({ type: z.literal("media"), binding: bindingSchema, altBinding: bindingSchema, aspect: z.enum(["portrait", "landscape", "square"]) }).strict(),
  baseNode.extend({ type: z.literal("callout"), titleBinding: bindingSchema, bodyBinding: bindingSchema }).strict(),
  baseNode.extend({ type: z.literal("action-row"), actions: actionItemsSchema() }).strict(),
  baseNode.extend({ type: z.literal("decorative-region"), regionId: idSchema, height: z.enum(["short", "medium", "tall"]) }).strict(),
]));

const placementSchema = z.object({
  columnStart: z.number().int().min(1).max(12), columnSpan: z.number().int().min(1).max(12),
  rowStart: z.number().int().min(1).max(12), rowSpan: z.number().int().min(1).max(12),
  order: z.number().int().min(0).max(24), align: z.enum(["start", "center", "end", "stretch"]),
  offsetX: z.enum(["none", "inset", "outset"]), offsetY: z.enum(["none", "up", "down"]),
}).strict().superRefine((placement, context) => {
  if (placement.columnStart + placement.columnSpan > 13) context.addIssue({ code: "custom", message: "Placed layer exceeds the 12-column canvas", path: ["columnSpan"] });
  if (placement.rowStart + placement.rowSpan > 13) context.addIssue({ code: "custom", message: "Placed layer exceeds the declared row grid", path: ["rowSpan"] });
});
const responsivePlacementSchema = z.object({ desktop: placementSchema, tablet: placementSchema, phone: placementSchema }).strict();

export const surfaceNodeSchema: z.ZodType<SurfaceNodeV2> = z.lazy(() => z.discriminatedUnion("type", [
  baseNode.extend({ type: z.literal("section"), tone: z.enum(["canvas", "surface", "accent", "secondary", "ink"]), layout: z.enum(["flow", "hero", "band", "cover"]), padding: spacingSchema, bleed: z.boolean(), minHeight: z.enum(["auto", "half", "viewport"]), background: z.enum(["solid", "wash", "spotlight", "paper-rule", "registration"]), backgroundMediaBinding: bindingSchema.nullable(), backgroundMediaOpacity: z.enum(["subtle", "medium", "strong"]), backgroundMediaFocalPoint: z.enum(["center", "top", "bottom", "left", "right"]), children: z.array(surfaceNodeSchema).max(60) }).strict(),
  baseNode.extend({ type: z.literal("container"), width: z.enum(["narrow", "standard", "wide", "full"]), align: z.enum(["start", "center", "end"]), padding: spacingSchema, children: z.array(surfaceNodeSchema).max(60) }).strict(),
  baseNode.extend({ type: z.literal("canvas"), columns: z.literal(12), rows: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10), z.literal(11), z.literal(12)]), gap: spacingSchema, minHeight: z.enum(["short", "medium", "tall", "viewport"]), clip: z.boolean(), children: z.array(surfaceNodeSchema).max(36) }).strict(),
  baseNode.extend({ type: z.literal("layer"), placement: responsivePlacementSchema, overlap: z.enum(["none", "soft", "strong"]), children: z.array(surfaceNodeSchema).max(24) }).strict(),
  baseNode.extend({ type: z.literal("stack"), gap: spacingSchema, align: alignSchema, justify: justifySchema, width: z.enum(["auto", "prose", "wide", "full"]), children: z.array(surfaceNodeSchema).max(60) }).strict(),
  baseNode.extend({ type: z.literal("grid"), columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), layout: z.enum(["equal", "feature-left", "feature-right", "sidebar-left", "sidebar-right"]), gap: spacingSchema, align: z.enum(["start", "center", "stretch"]), children: z.array(surfaceNodeSchema).max(40) }).strict(),
  baseNode.extend({ type: z.literal("split"), ratio: z.enum(["1-1", "2-3", "3-2", "1-2", "2-1"]), gap: spacingSchema, align: z.enum(["start", "center", "end", "stretch"]), reverseOnMobile: z.boolean(), children: z.tuple([surfaceNodeSchema, surfaceNodeSchema]) }).strict(),
  baseNode.extend({ type: z.literal("cluster"), gap: spacingSchema, align: alignSchema, justify: justifySchema, children: z.array(surfaceNodeSchema).max(40) }).strict(),
  baseNode.extend({ type: z.literal("frame"), tone: z.enum(["transparent", "canvas", "surface", "accent", "secondary", "ink"]), padding: spacingSchema, border: z.enum(["none", "hairline", "strong"]), elevation: z.enum(["none", "directional", "tonal"]), rotation: z.enum(["none", "left", "right"]), span: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), children: z.array(surfaceNodeSchema).max(40) }).strict(),
  baseNode.extend({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), binding: bindingSchema, fallback: z.string().max(160), size: z.enum(["hero", "display", "section", "subsection"]), align: alignSchema, width: z.enum(["tight", "balanced", "full"]), weight: z.enum(["light", "regular", "bold", "black"]), lineHeight: z.enum(["tight", "snug", "normal"]), tracking: z.enum(["tight", "normal", "wide"]) }).strict(),
  baseNode.extend({ type: z.literal("text"), style: z.enum(["body", "lead", "caption", "data", "eyebrow", "quote"]), binding: bindingSchema, fallback: z.string().max(320), align: alignSchema, width: z.enum(["prose", "narrow", "full"]), weight: z.enum(["regular", "medium", "bold"]), lineHeight: z.enum(["tight", "snug", "normal", "relaxed"]), tracking: z.enum(["tight", "normal", "wide"]) }).strict(),
  baseNode.extend({ type: z.literal("fact-list"), binding: bindingSchema, emptyMessage: z.string().max(160), layout: z.enum(["grid", "inline", "rail"]), emphasis: z.enum(["quiet", "strong"]) }).strict(),
  baseNode.extend({ type: z.literal("tag-list"), binding: bindingSchema, emptyMessage: z.string().max(160), style: z.enum(["plain", "boxed", "stamp"]) }).strict(),
  baseNode.extend({ type: z.literal("project-list"), binding: bindingSchema, emptyMessage: z.string().max(160), layout: z.enum(["cards", "editorial", "featured"]), columns: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
  baseNode.extend({ type: z.literal("featured-project"), binding: bindingSchema, index: z.number().int().min(0).max(11), layout: z.enum(["media-left", "media-right", "poster", "artifact"]), showTags: z.boolean(), showMetrics: z.boolean() }).strict(),
  baseNode.extend({ type: z.literal("project-artifact"), binding: bindingSchema, index: z.number().int().min(0).max(11), variant: z.enum(["orbit-map", "type-field", "signal-path", "stacked-planes"]), tone: z.enum(["canvas", "surface", "accent", "secondary", "ink"]), scale: z.enum(["medium", "large", "hero"]) }).strict(),
  baseNode.extend({ type: z.literal("media"), binding: bindingSchema, altBinding: bindingSchema, aspect: z.enum(["portrait", "landscape", "square", "panoramic", "auto"]), fit: z.enum(["cover", "contain"]), focalPoint: z.enum(["center", "top", "bottom", "left", "right"]), treatment: z.enum(["plain", "framed", "offset", "monochrome"]) }).strict(),
  baseNode.extend({ type: z.literal("gallery"), items: z.array(z.object({ binding: bindingSchema, altBinding: bindingSchema }).strict()).min(2).max(12), layout: z.enum(["grid", "filmstrip", "masonry"]), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), treatment: z.enum(["plain", "framed", "offset", "monochrome"]) }).strict(),
  baseNode.extend({ type: z.literal("callout"), titleBinding: bindingSchema, bodyBinding: bindingSchema, variant: z.enum(["note", "manifesto", "quote"]), tone: z.enum(["surface", "accent", "secondary", "ink"]) }).strict(),
  baseNode.extend({ type: z.literal("divider"), style: z.enum(["solid", "dashed", "accent", "stamp"]) }).strict(),
  baseNode.extend({ type: z.literal("spacer"), size: z.enum(["xs", "sm", "md", "lg", "xl"]) }).strict(),
  baseNode.extend({ type: z.literal("decorative-mark"), mark: z.enum(["circle", "cross", "star", "orbit", "checker", "bracket"]), size: z.enum(["sm", "md", "lg", "xl"]), position: z.enum(["inline", "top-left", "top-right", "bottom-left", "bottom-right"]), tone: z.enum(["accent", "secondary", "highlight", "ink"]) }).strict(),
  baseNode.extend({ type: z.literal("motif-line"), path: z.enum(["arc", "loop", "diagonal", "meander"]), weight: z.enum(["hairline", "regular", "bold"]), tone: z.enum(["accent", "secondary", "highlight", "ink"]), span: z.enum(["local", "section", "cross-section"]) }).strict(),
  baseNode.extend({ type: z.literal("action-row"), actions: actionItemsSchema() }).strict(),
  baseNode.extend({ type: z.literal("action-slot"), placement: z.enum(["hero", "inline", "footer"]), actions: actionItemsSchema() }).strict(),
  baseNode.extend({ type: z.literal("decorative-region"), regionId: idSchema, height: z.enum(["short", "medium", "tall", "viewport"]) }).strict(),
]));

function actionItemsSchema() {
  return z.array(z.object({ id: idSchema, action: actionSchema, supportingCopy: z.string().min(1).max(100).optional() }).strict()).min(1).max(3);
}

export const decorativeRegionSchema = z.object({
  id: idSchema, label: z.string().min(1).max(100), html: z.string().max(12_000), css: z.string().max(20_000),
}).strict();

const bindingManifestV1 = z.object({
  content: z.array(z.object({ key: bindingSchema, type: z.enum(["text", "facts", "projects"]) }).strict()).max(80),
  media: z.array(z.object({ key: bindingSchema, altKey: bindingSchema, approvedAssetIds: z.array(assetIdSchema).min(1).max(12) }).strict()).max(20),
}).strict();

const bindingManifestV2 = z.object({
  content: z.array(z.object({ key: bindingSchema, type: z.enum(["text", "facts", "projects", "strings"]) }).strict()).max(120),
  media: z.array(z.object({ key: bindingSchema, altKey: bindingSchema, approvedAssetIds: z.array(assetIdSchema).min(1).max(12), authorization: z.literal("surface-approved") }).strict()).max(40),
}).strict();

const generatedDocumentSchema = z.object({
  html: z.string().min(1).max(180_000),
  css: z.string().max(180_000),
}).strict();

function createV1SurfaceSpecSchema<const Version extends string>(policyVersion: Version) {
  return z.object({
    schemaVersion: z.literal("1"), designPolicyVersion: z.literal(policyVersion), kind: z.enum(["profile", "room", "circle"]), title: z.string().min(1).max(120),
    theme: legacySurfaceThemeSchema, root: legacySurfaceNodeSchema, bindingManifest: bindingManifestV1,
    approvedAssets: approvedAssetsSchema(), decorativeRegions: z.array(decorativeRegionSchema).max(8),
    responsive: z.object({ collapseGridsBelow: z.enum(["sm", "md", "lg"]), contentWidth: z.enum(["narrow", "standard", "wide"]), edgePadding: z.enum(["compact", "comfortable", "generous"]) }).strict(),
    accessibility: accessibilitySchema(),
  }).strict().superRefine((spec, context) => refineSurfaceSpec(spec, context, 160, 12));
}

function createV2SurfaceSpecSchema<const Version extends string>(policyVersion: Version) {
  return z.object({
    schemaVersion: z.literal("2"), designPolicyVersion: z.literal(policyVersion), kind: z.enum(["profile", "room", "circle"]), title: z.string().min(1).max(120),
    theme: surfaceThemeSchema, root: surfaceNodeSchema, bindingManifest: bindingManifestV2,
    approvedAssets: approvedAssetsSchema(), decorativeRegions: z.array(decorativeRegionSchema).max(12),
    responsive: z.object({
      collapseGridsBelow: z.enum(["sm", "md", "lg"]), contentWidth: z.enum(["narrow", "standard", "wide", "full"]), edgePadding: z.enum(["compact", "comfortable", "generous"]),
      heroStackBelow: z.enum(["sm", "md", "lg"]), preserveContentOrder: z.literal(true),
    }).strict(),
    accessibility: accessibilitySchema(),
  }).strict().superRefine((spec, context) => refineSurfaceSpec(spec, context, 240, 14));
}

const legacyV2SurfaceSpecSchema = createV2SurfaceSpecSchema(LEGACY_V2_DESIGN_POLICY_VERSION);
const priorActiveSurfaceSpecSchema = createV2SurfaceSpecSchema(PRIOR_ACTIVE_DESIGN_POLICY_VERSION);
const componentV2SurfaceSpecSchema = createV2SurfaceSpecSchema(COMPONENT_V2_DESIGN_POLICY_VERSION);
function createGeneratedSiteSpecSchema<const Version extends string, const Kinds extends readonly ["profile" | "room" | "circle", ...Array<"profile" | "room" | "circle">]>(policyVersion: Version, kinds: Kinds) {
  return z.object({
  schemaVersion: z.literal("3"), designPolicyVersion: z.literal(policyVersion), kind: z.enum(kinds), title: z.string().min(1).max(120),
  document: generatedDocumentSchema,
  bindingManifest: bindingManifestV2,
  approvedAssets: approvedAssetsSchema(),
  responsive: z.object({ desktopMinHeight: z.number().int().min(600).max(24_000), phoneMinHeight: z.number().int().min(600).max(32_000) }).strict(),
  accessibility: z.object({ label: z.string().min(1).max(160), reducedMotion: z.literal("required") }).strict(),
}).strict().superRefine((spec, context) => {
  const issues = validateGeneratedSiteSource({ html: spec.document.html, css: spec.document.css, approvedAssetSources: spec.approvedAssets.map((asset) => asset.src) });
  for (const message of issues) context.addIssue({ code: "custom", message, path: message.startsWith("document.css") ? ["document", "css"] : ["document", "html"] });
  const content = new Set(spec.bindingManifest.content.map((binding) => binding.key));
  const media = new Set(spec.bindingManifest.media.map((binding) => binding.key));
  const assets = new Set(spec.approvedAssets.map((asset) => asset.id));
  if (content.size !== spec.bindingManifest.content.length || media.size !== spec.bindingManifest.media.length || assets.size !== spec.approvedAssets.length) context.addIssue({ code: "custom", message: "Binding and asset identifiers must be unique", path: ["bindingManifest"] });
  for (const binding of spec.bindingManifest.content) {
    const used = new RegExp(`\\{\\{\\s*${binding.key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\}\\}|data-buildmates-repeat=[\"']${binding.key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[\"']`, "i").test(spec.document.html);
    if (!used) context.addIssue({ code: "custom", message: `Declared binding is not rendered: ${binding.key}`, path: ["bindingManifest", "content"] });
  }
  const declaredContent = new Map(spec.bindingManifest.content.map((binding) => [binding.key, binding.type]));
  for (const token of spec.document.html.matchAll(/\{\{\s*([a-z][a-z0-9_.-]{0,95}|item\.(?:label|value|id|title|summary|href|tags|metrics))\s*\}\}/gi)) {
    const key = token[1];
    if (!key.startsWith("item.") && !declaredContent.has(key)) context.addIssue({ code: "custom", message: `Undeclared content binding: ${key}`, path: ["document", "html"] });
  }
  for (const repeat of spec.document.html.matchAll(/data-buildmates-repeat=["']([a-z][a-z0-9_.-]{0,95})["']/gi)) {
    const type = declaredContent.get(repeat[1]);
    if (!type || type === "text") context.addIssue({ code: "custom", message: `Repeat binding must declare an array-shaped content type: ${repeat[1]}`, path: ["document", "html"] });
  }
  for (const binding of spec.bindingManifest.media) if (binding.approvedAssetIds.some((id) => !assets.has(id))) context.addIssue({ code: "custom", message: `Media binding ${binding.key} references an unapproved asset`, path: ["bindingManifest", "media"] });
  });
}
const profileGeneratedSiteSpecSchema = createGeneratedSiteSpecSchema(PROFILE_V3_DESIGN_POLICY_VERSION, ["profile"]);
export const generatedSiteSpecSchema = createGeneratedSiteSpecSchema(DESIGN_POLICY_VERSION, ["profile", "room", "circle"]);
const profileV3ComponentSurfaceSpecSchema = createV2SurfaceSpecSchema(PROFILE_V3_DESIGN_POLICY_VERSION);
const profileV3SurfaceSpecSchema = z.union([profileGeneratedSiteSpecSchema, profileV3ComponentSurfaceSpecSchema]);
const activeComponentSurfaceSpecSchema = createV2SurfaceSpecSchema(DESIGN_POLICY_VERSION);
export const activeSurfaceSpecSchema = z.union([generatedSiteSpecSchema, activeComponentSurfaceSpecSchema]);

function approvedAssetsSchema() {
  return z.array(z.object({ id: assetIdSchema, src: z.string().regex(/^\/api\/surface-assets\/[a-z0-9_-]+\/[a-f0-9]{64}\.(?:avif|gif|jpe?g|png|webp)$/i) }).strict()).max(60);
}

function accessibilitySchema() {
  return z.object({ label: z.string().min(1).max(160), primaryHeadingNodeId: idSchema, reducedMotion: z.literal("required") }).strict();
}

type RefinableSpec = {
  theme: { colors: Record<string, string> };
  root: SurfaceNode;
  bindingManifest: { content: Array<{ key: string; type: string }>; media: Array<{ key: string; altKey: string; approvedAssetIds: string[]; authorization?: "surface-approved" }> };
  approvedAssets: Array<{ id: string }>;
  decorativeRegions: Array<{ id: string }>;
  accessibility: { primaryHeadingNodeId: string };
};

function refineSurfaceSpec(spec: RefinableSpec, context: z.RefinementCtx, maximumNodes: number, maximumDepth: number) {
  const nodes: SurfaceNode[] = [];
  const ids = new Set<string>();
  let maxDepth = 0;
  const walk = (node: SurfaceNode, depth: number) => {
    nodes.push(node);
    maxDepth = Math.max(maxDepth, depth);
    if (ids.has(node.id)) context.addIssue({ code: "custom", message: `Duplicate node id: ${node.id}`, path: ["root"] });
    ids.add(node.id);
    if ("children" in node) node.children.forEach((child) => walk(child, depth + 1));
  };
  walk(spec.root, 1);
  if (nodes.length > maximumNodes) context.addIssue({ code: "custom", message: `Surface exceeds ${maximumNodes} trusted nodes`, path: ["root"] });
  if (maxDepth > maximumDepth) context.addIssue({ code: "custom", message: `Surface tree exceeds depth ${maximumDepth}`, path: ["root"] });
  const primary = nodes.find((node) => node.id === spec.accessibility.primaryHeadingNodeId);
  if (!primary || primary.type !== "heading" || primary.level !== 1) context.addIssue({ code: "custom", message: "primaryHeadingNodeId must point to the level-one heading", path: ["accessibility", "primaryHeadingNodeId"] });
  if (nodes.filter((node) => node.type === "heading" && node.level === 1).length !== 1) context.addIssue({ code: "custom", message: "Surface must contain exactly one level-one heading", path: ["root"] });
  let previousHeading = 0;
  for (const node of nodes) {
    if (node.type !== "heading") continue;
    if (previousHeading === 0 && node.level !== 1) context.addIssue({ code: "custom", message: "The first heading must be level one", path: ["root"] });
    if (previousHeading > 0 && node.level > previousHeading + 1) context.addIssue({ code: "custom", message: `Heading level skips from ${previousHeading} to ${node.level}`, path: ["root"] });
    previousHeading = node.level;
  }
  const regions = new Set(spec.decorativeRegions.map((region) => region.id));
  const contentBindings = new Map(spec.bindingManifest.content.map((binding) => [binding.key, binding.type]));
  const mediaBindings = new Map(spec.bindingManifest.media.map((binding) => [binding.key, binding]));
  const approvedAssets = new Set(spec.approvedAssets.map((asset) => asset.id));
  if (contentBindings.size !== spec.bindingManifest.content.length || mediaBindings.size !== spec.bindingManifest.media.length || approvedAssets.size !== spec.approvedAssets.length) context.addIssue({ code: "custom", message: "Binding and asset manifest identifiers must be unique", path: ["bindingManifest"] });
  for (const media of spec.bindingManifest.media) {
    if (contentBindings.has(media.key)) context.addIssue({ code: "custom", message: `Binding key ${media.key} cannot be both content and media`, path: ["bindingManifest", "media"] });
    if (media.approvedAssetIds.some((id) => !approvedAssets.has(id))) context.addIssue({ code: "custom", message: `Media binding ${media.key} references an unapproved asset`, path: ["bindingManifest", "media"] });
  }
  for (const node of nodes) {
    if (node.type === "canvas" && node.children.some((child) => child.type !== "layer")) context.addIssue({ code: "custom", message: "Canvas children must be governed layers", path: ["root"] });
    if (node.type === "layer") {
      const placements = [node.placement.desktop, node.placement.tablet, node.placement.phone];
      if (placements.some((placement) => placement.rowStart + placement.rowSpan > 13)) context.addIssue({ code: "custom", message: "Placed layer exceeds the 12-row canvas", path: ["root"] });
    }
    if (node.type === "decorative-region" && !regions.has(node.regionId)) context.addIssue({ code: "custom", message: `Missing decorative region: ${node.regionId}`, path: ["root"] });
    if ((node.type === "heading" || node.type === "text") && contentBindings.get(node.binding) !== "text") bindingIssue(context, node.binding);
    if (node.type === "fact-list" && contentBindings.get(node.binding) !== "facts") bindingIssue(context, node.binding);
    if (node.type === "tag-list" && contentBindings.get(node.binding) !== "strings") bindingIssue(context, node.binding);
    if (node.type === "project-list" && contentBindings.get(node.binding) !== "projects") bindingIssue(context, node.binding);
    if (node.type === "featured-project" && contentBindings.get(node.binding) !== "projects") bindingIssue(context, node.binding);
    if (node.type === "project-artifact" && contentBindings.get(node.binding) !== "projects") bindingIssue(context, node.binding);
    if (node.type === "callout") for (const key of [node.titleBinding, node.bodyBinding]) if (contentBindings.get(key) !== "text") bindingIssue(context, key);
    if (node.type === "media") validateMediaBinding(node.binding, node.altBinding, contentBindings, mediaBindings, context);
    if (node.type === "gallery") for (const item of node.items) validateMediaBinding(item.binding, item.altBinding, contentBindings, mediaBindings, context);
    if (node.type === "section" && "backgroundMediaBinding" in node && node.backgroundMediaBinding && !mediaBindings.has(node.backgroundMediaBinding)) context.addIssue({ code: "custom", message: `Undeclared background media binding: ${node.backgroundMediaBinding}`, path: ["root"] });
  }
  for (const pair of renderedContrastPairs(spec.theme.colors)) if (contrastRatio(pair.foreground, pair.background) < 4.5) context.addIssue({ code: "custom", message: `${pair.label} contrast must be at least 4.5:1`, path: ["theme", "colors"] });
  const { focusInner, focusOuter } = spec.theme.colors;
  if (contrastRatio(focusInner, focusOuter) < 3) context.addIssue({ code: "custom", message: "Focus rings must contrast with each other by at least 3:1", path: ["theme", "colors"] });
  for (const [label, background] of renderedBackgrounds(spec.theme.colors)) if (Math.max(contrastRatio(focusInner, background), contrastRatio(focusOuter, background)) < 3) context.addIssue({ code: "custom", message: `At least one focus ring must contrast with ${label} by 3:1`, path: ["theme", "colors"] });
}

function bindingIssue(context: z.RefinementCtx, key: string) {
  context.addIssue({ code: "custom", message: `Undeclared or incorrectly typed binding: ${key}`, path: ["root"] });
}

function validateMediaBinding(binding: string, altBinding: string, content: ReadonlyMap<string, string>, media: ReadonlyMap<string, { altKey: string }>, context: z.RefinementCtx) {
  const declaration = media.get(binding);
  if (!declaration || declaration.altKey !== altBinding || content.get(altBinding) !== "text") context.addIssue({ code: "custom", message: `Undeclared media binding: ${binding}`, path: ["root"] });
}

const historicalSurfaceSpecSchema = createV1SurfaceSpecSchema(HISTORICAL_DESIGN_POLICY_VERSION);
const previousSurfaceSpecSchema = createV1SurfaceSpecSchema(PREVIOUS_DESIGN_POLICY_VERSION);

const MAX_SURFACE_SPEC_BYTES = 480_000;
const MAX_SURFACE_VALUE_DEPTH = 72;
const MAX_SURFACE_VALUES = 8_000;
const PREFLIGHT_REJECTED = Object.freeze({ __surfacePreflightRejected: true });

function surfaceValuePassesPreflight(input: unknown): boolean {
  try {
    const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
    const seen = new WeakSet<object>();
    let values = 0;
    let estimatedBytes = 0;
    while (stack.length) {
      const { value, depth } = stack.pop()!;
      if (++values > MAX_SURFACE_VALUES || depth > MAX_SURFACE_VALUE_DEPTH) return false;
      if (typeof value === "string") { estimatedBytes += value.length * 2; if (estimatedBytes > MAX_SURFACE_SPEC_BYTES) return false; continue; }
      if (value === null || typeof value === "boolean") continue;
      if (typeof value === "number") { if (!Number.isFinite(value)) return false; continue; }
      if (typeof value !== "object") return false;
      const object = value as Record<string, unknown>;
      if (seen.has(object)) return false;
      seen.add(object);
      const keys = Object.keys(object);
      values += keys.length;
      if (values > MAX_SURFACE_VALUES) return false;
      for (const key of keys) { estimatedBytes += key.length * 2; if (estimatedBytes > MAX_SURFACE_SPEC_BYTES) return false; stack.push({ value: object[key], depth: depth + 1 }); }
    }
    return true;
  } catch { return false; }
}

export const surfaceSpecSchema = z.preprocess((input) => surfaceValuePassesPreflight(input) ? input : PREFLIGHT_REJECTED, z.union([activeSurfaceSpecSchema, componentV2SurfaceSpecSchema]));

export const SURFACE_POLICY_REGISTRY = Object.freeze({
  [HISTORICAL_DESIGN_POLICY_VERSION]: Object.freeze({ version: HISTORICAL_DESIGN_POLICY_VERSION, designPolicyId: HISTORICAL_DESIGN_POLICY_ID, sourceHash: HISTORICAL_DESIGN_POLICY_SOURCE_HASH, policyJson: HISTORICAL_DESIGN_POLICY_SOURCE, parserVersion: "surface-spec-1", reading: "allowed", revisionCreation: "allowed" }),
  [PREVIOUS_DESIGN_POLICY_VERSION]: Object.freeze({ version: PREVIOUS_DESIGN_POLICY_VERSION, designPolicyId: PREVIOUS_DESIGN_POLICY_ID, sourceHash: PREVIOUS_DESIGN_POLICY_SOURCE_HASH, policyJson: PREVIOUS_DESIGN_POLICY_SOURCE, parserVersion: "surface-spec-1", reading: "allowed", revisionCreation: "allowed" }),
  [LEGACY_V2_DESIGN_POLICY_VERSION]: Object.freeze({ version: LEGACY_V2_DESIGN_POLICY_VERSION, designPolicyId: LEGACY_V2_DESIGN_POLICY_ID, sourceHash: LEGACY_V2_DESIGN_POLICY_SOURCE_HASH, policyJson: LEGACY_V2_DESIGN_POLICY_SOURCE, parserVersion: "surface-spec-2", reading: "allowed", revisionCreation: "allowed" }),
  [PRIOR_ACTIVE_DESIGN_POLICY_VERSION]: Object.freeze({ version: PRIOR_ACTIVE_DESIGN_POLICY_VERSION, designPolicyId: PRIOR_ACTIVE_DESIGN_POLICY_ID, sourceHash: PRIOR_ACTIVE_DESIGN_POLICY_SOURCE_HASH, policyJson: PRIOR_ACTIVE_DESIGN_POLICY_SOURCE, parserVersion: "surface-spec-2", reading: "allowed", revisionCreation: "allowed" }),
  [COMPONENT_V2_DESIGN_POLICY_VERSION]: Object.freeze({ version: COMPONENT_V2_DESIGN_POLICY_VERSION, designPolicyId: COMPONENT_V2_DESIGN_POLICY_ID, sourceHash: COMPONENT_V2_DESIGN_POLICY_SOURCE_HASH, policyJson: COMPONENT_V2_DESIGN_POLICY_SOURCE, parserVersion: "surface-spec-2", reading: "allowed", revisionCreation: "allowed" }),
  [PROFILE_V3_DESIGN_POLICY_VERSION]: Object.freeze({ version: PROFILE_V3_DESIGN_POLICY_VERSION, designPolicyId: PROFILE_V3_DESIGN_POLICY_ID, sourceHash: PROFILE_V3_DESIGN_POLICY_SOURCE_HASH, policyJson: PROFILE_V3_DESIGN_POLICY_SOURCE, parserVersion: "generated-site-bundle-3", reading: "allowed", revisionCreation: "allowed" }),
  [DESIGN_POLICY_VERSION]: Object.freeze({ version: DESIGN_POLICY_VERSION, designPolicyId: DESIGN_POLICY_ID, sourceHash: DESIGN_POLICY_SOURCE_HASH, policyJson: DESIGN_POLICY_SOURCE, parserVersion: "generated-site-bundle-3", reading: "allowed", revisionCreation: "allowed" }),
} as const);

type SurfacePolicyVersion = keyof typeof SURFACE_POLICY_REGISTRY;
export type SurfaceSpecV1 = z.infer<typeof historicalSurfaceSpecSchema> | z.infer<typeof previousSurfaceSpecSchema>;
export type SurfaceSpecV2 = z.infer<typeof activeComponentSurfaceSpecSchema> | z.infer<typeof profileV3ComponentSurfaceSpecSchema> | z.infer<typeof componentV2SurfaceSpecSchema> | z.infer<typeof priorActiveSurfaceSpecSchema> | z.infer<typeof legacyV2SurfaceSpecSchema>;
export type SurfaceSpecV3 = z.infer<typeof generatedSiteSpecSchema> | z.infer<typeof profileGeneratedSiteSpecSchema>;
export type SurfaceSpec = SurfaceSpecV1 | SurfaceSpecV2 | SurfaceSpecV3;
export type SurfaceSpecParseResult = { success: true; data: SurfaceSpec } | { success: false; error: z.ZodError };

const policySchemas: Record<SurfacePolicyVersion, z.ZodType<SurfaceSpec>> = {
  [HISTORICAL_DESIGN_POLICY_VERSION]: historicalSurfaceSpecSchema,
  [PREVIOUS_DESIGN_POLICY_VERSION]: previousSurfaceSpecSchema,
  [LEGACY_V2_DESIGN_POLICY_VERSION]: legacyV2SurfaceSpecSchema,
  [PRIOR_ACTIVE_DESIGN_POLICY_VERSION]: priorActiveSurfaceSpecSchema,
  [COMPONENT_V2_DESIGN_POLICY_VERSION]: componentV2SurfaceSpecSchema,
  [PROFILE_V3_DESIGN_POLICY_VERSION]: profileV3SurfaceSpecSchema,
  [DESIGN_POLICY_VERSION]: activeSurfaceSpecSchema,
};

export function isSurfacePolicyCompatible(input: { id: string; version: string; sourceHash: string; policyJson: string }, options?: { forRevisionCreation?: boolean }): boolean {
  if (!(input.version in SURFACE_POLICY_REGISTRY)) return false;
  const registered = SURFACE_POLICY_REGISTRY[input.version as SurfacePolicyVersion];
  return registered.reading === "allowed" && registered.designPolicyId === input.id && registered.sourceHash === input.sourceHash && registered.policyJson === input.policyJson && (!options?.forRevisionCreation || registered.revisionCreation === "allowed");
}

export function safeParseSurfaceSpec(input: unknown, expectedVersion?: string, options?: { forRevisionCreation?: boolean }): SurfaceSpecParseResult {
  try {
    if (!surfaceValuePassesPreflight(input)) return failedSurfaceParse();
    const claimedVersion = input !== null && typeof input === "object" ? (input as { designPolicyVersion?: unknown }).designPolicyVersion : undefined;
    const version = expectedVersion ?? claimedVersion;
    if (typeof version !== "string" || claimedVersion !== version || !(version in SURFACE_POLICY_REGISTRY)) return failedSurfaceParse();
    const registered = SURFACE_POLICY_REGISTRY[version as SurfacePolicyVersion];
    if (registered.reading !== "allowed" || (options?.forRevisionCreation && registered.revisionCreation !== "allowed")) return failedSurfaceParse();
    return policySchemas[version as SurfacePolicyVersion].safeParse(input) as SurfaceSpecParseResult;
  } catch { return failedSurfaceParse(); }
}

function failedSurfaceParse(): SurfaceSpecParseResult {
  return z.never().safeParse(PREFLIGHT_REJECTED) as SurfaceSpecParseResult;
}

export function parseSurfaceSpecJson(specJson: string, expectedVersion?: string, options?: { forRevisionCreation?: boolean }): SurfaceSpec {
  try {
    if (specJson.length > MAX_SURFACE_SPEC_BYTES || new TextEncoder().encode(specJson).byteLength > MAX_SURFACE_SPEC_BYTES) throw new Error("surface_spec_invalid");
    const parsed = safeParseSurfaceSpec(JSON.parse(specJson), expectedVersion, options);
    if (!parsed.success) throw new Error("surface_spec_invalid");
    return parsed.data;
  } catch { throw new Error("surface_spec_invalid"); }
}

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateSurfaceContrast(spec: Pick<SurfaceSpecV1 | SurfaceSpecV2, "theme">): { passed: boolean; minimumRatio: number; minimumPair: string } {
  const results = renderedContrastPairs(spec.theme.colors).map((pair) => ({ ...pair, ratio: contrastRatio(pair.foreground, pair.background) }));
  const minimum = results.reduce((left, right) => left.ratio <= right.ratio ? left : right);
  return { passed: results.every((result) => result.ratio >= 4.5), minimumRatio: minimum.ratio, minimumPair: minimum.label };
}

export function renderedContrastPairs(colors: Record<string, string>): Array<{ foreground: string; background: string; label: string }> {
  const projectPanel = mixHex(colors.surface, colors.ink, 0.96);
  const pairs = [
    { foreground: colors.ink, background: colors.canvas, label: "Canvas text" },
    { foreground: colors.mutedInk, background: colors.canvas, label: "Canvas muted text" },
    { foreground: colors.ink, background: colors.surface, label: "Panel text" },
    { foreground: colors.mutedInk, background: colors.surface, label: "Panel muted text" },
    { foreground: colors.accentInk, background: colors.accent, label: "Accent text" },
    { foreground: colors.mutedInk, background: colors.accent, label: "Accent muted text" },
    { foreground: colors.accentInk, background: colors.canvas, label: "Nested accent text on canvas" },
    { foreground: colors.accentInk, background: colors.surface, label: "Nested accent text on panel" },
    { foreground: colors.ink, background: projectPanel, label: "Project title on project panel" },
    { foreground: colors.accentInk, background: projectPanel, label: "Nested accent text on project panel" },
  ];
  if (colors.secondary && colors.secondaryInk) pairs.push({ foreground: colors.secondaryInk, background: colors.secondary, label: "Secondary text" });
  if (colors.highlight && colors.highlightInk) pairs.push({ foreground: colors.highlightInk, background: colors.highlight, label: "Highlight text" });
  return pairs;
}

function renderedBackgrounds(colors: Record<string, string>): Array<[string, string]> {
  const values: Array<[string, string]> = [["canvas", colors.canvas], ["panel", colors.surface], ["accent", colors.accent], ["project panel", mixHex(colors.surface, colors.ink, 0.96)]];
  if (colors.secondary) values.push(["secondary", colors.secondary]);
  if (colors.highlight) values.push(["highlight", colors.highlight]);
  return values;
}

function mixHex(left: string, right: string, leftWeight: number): string {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) => Math.round(channel(left, offset) * leftWeight + channel(right, offset) * (1 - leftWeight)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
