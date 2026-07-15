import { z } from "zod";
import { DESIGN_POLICY_ID, DESIGN_POLICY_SOURCE, DESIGN_POLICY_SOURCE_HASH, DESIGN_POLICY_VERSION, HISTORICAL_DESIGN_POLICY_ID, HISTORICAL_DESIGN_POLICY_SOURCE, HISTORICAL_DESIGN_POLICY_SOURCE_HASH, HISTORICAL_DESIGN_POLICY_VERSION } from "./design-policy";

const idSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/i);
const bindingSchema = z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/i);
const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const textStyleSchema = z.enum(["body", "lead", "caption", "data"]);
const spacingSchema = z.enum(["none", "xs", "sm", "md", "lg", "xl"]);
const alignSchema = z.enum(["start", "center", "end"]);
const assetIdSchema = z.string().regex(/^asset_[a-z0-9_-]{8,80}$/i);
const actionSchema = z.enum(["connect", "follow", "report", "privacy", "navigate"]);

export const surfaceThemeSchema = z
  .object({
    mode: z.enum(["light", "dark"]),
    colors: z
      .object({
        canvas: hexColorSchema,
        surface: hexColorSchema,
        ink: hexColorSchema,
        mutedInk: hexColorSchema,
        accent: hexColorSchema,
        accentInk: hexColorSchema,
        rule: hexColorSchema,
        focusInner: hexColorSchema,
        focusOuter: hexColorSchema,
      })
      .strict(),
    typography: z
      .object({
        display: z.enum(["editorial", "humanist", "technical"]),
        body: z.enum(["humanist", "neutral"]),
        scale: z.enum(["compact", "comfortable", "generous"]),
      })
      .strict(),
    shape: z
      .object({
        corners: z.enum(["square", "soft", "rounded"]),
        density: z.enum(["compact", "comfortable", "spacious"]),
      })
      .strict(),
  })
  .strict();

const baseNode = z.object({ id: idSchema }).strict();

export type SurfaceNode =
  | { id: string; type: "section"; tone: "canvas" | "surface" | "accent"; children: SurfaceNode[] }
  | { id: string; type: "stack"; gap: z.infer<typeof spacingSchema>; align: z.infer<typeof alignSchema>; children: SurfaceNode[] }
  | { id: string; type: "grid"; columns: 1 | 2 | 3; gap: z.infer<typeof spacingSchema>; children: SurfaceNode[] }
  | { id: string; type: "heading"; level: 1 | 2 | 3 | 4; binding: string; fallback: string }
  | { id: string; type: "text"; style: z.infer<typeof textStyleSchema>; binding: string; fallback: string }
  | { id: string; type: "fact-list"; binding: string; emptyMessage: string }
  | { id: string; type: "project-list"; binding: string; emptyMessage: string }
  | { id: string; type: "media"; binding: string; altBinding: string; aspect: "portrait" | "landscape" | "square" }
  | { id: string; type: "callout"; titleBinding: string; bodyBinding: string }
  | { id: string; type: "action-row"; actions: Array<{ id: string; action: z.infer<typeof actionSchema>; supportingCopy?: string }> }
  | { id: string; type: "decorative-region"; regionId: string; height: "short" | "medium" | "tall" };

const surfaceNodeSchema: z.ZodType<SurfaceNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    baseNode.extend({ type: z.literal("section"), tone: z.enum(["canvas", "surface", "accent"]), children: z.array(surfaceNodeSchema).max(40) }).strict(),
    baseNode.extend({ type: z.literal("stack"), gap: spacingSchema, align: alignSchema, children: z.array(surfaceNodeSchema).max(40) }).strict(),
    baseNode.extend({ type: z.literal("grid"), columns: z.union([z.literal(1), z.literal(2), z.literal(3)]), gap: spacingSchema, children: z.array(surfaceNodeSchema).max(24) }).strict(),
    baseNode.extend({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), binding: bindingSchema, fallback: z.string().max(160) }).strict(),
    baseNode.extend({ type: z.literal("text"), style: textStyleSchema, binding: bindingSchema, fallback: z.string().max(320) }).strict(),
    baseNode.extend({ type: z.literal("fact-list"), binding: bindingSchema, emptyMessage: z.string().max(160) }).strict(),
    baseNode.extend({ type: z.literal("project-list"), binding: bindingSchema, emptyMessage: z.string().max(160) }).strict(),
    baseNode.extend({ type: z.literal("media"), binding: bindingSchema, altBinding: bindingSchema, aspect: z.enum(["portrait", "landscape", "square"]) }).strict(),
    baseNode.extend({ type: z.literal("callout"), titleBinding: bindingSchema, bodyBinding: bindingSchema }).strict(),
    baseNode.extend({ type: z.literal("action-row"), actions: z.array(z.object({ id: idSchema, action: actionSchema, supportingCopy: z.string().min(1).max(100).optional() }).strict()).min(1).max(3) }).strict(),
    baseNode.extend({ type: z.literal("decorative-region"), regionId: idSchema, height: z.enum(["short", "medium", "tall"]) }).strict(),
  ]),
);

export const decorativeRegionSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1).max(100),
    html: z.string().max(12_000),
    css: z.string().max(20_000),
  })
  .strict();

function createRecursiveSurfaceSpecSchema<const Version extends string>(policyVersion: Version) {
  return z
  .object({
    schemaVersion: z.literal("1"),
    designPolicyVersion: z.literal(policyVersion),
    kind: z.enum(["profile", "room", "circle"]),
    title: z.string().min(1).max(120),
    theme: surfaceThemeSchema,
    root: surfaceNodeSchema,
    bindingManifest: z.object({
      content: z.array(z.object({ key: bindingSchema, type: z.enum(["text", "facts", "projects"]) }).strict()).max(80),
      media: z.array(z.object({ key: bindingSchema, altKey: bindingSchema, approvedAssetIds: z.array(assetIdSchema).min(1).max(12) }).strict()).max(20),
    }).strict(),
    approvedAssets: z.array(z.object({ id: assetIdSchema, src: z.string().regex(/^\/api\/surface-assets\/[a-z0-9_-]+\/[a-f0-9]{64}\.(?:avif|gif|jpe?g|png|webp)$/i) }).strict()).max(40),
    decorativeRegions: z.array(decorativeRegionSchema).max(8),
    responsive: z
      .object({
        collapseGridsBelow: z.enum(["sm", "md", "lg"]),
        contentWidth: z.enum(["narrow", "standard", "wide"]),
        edgePadding: z.enum(["compact", "comfortable", "generous"]),
      })
      .strict(),
    accessibility: z
      .object({
        label: z.string().min(1).max(160),
        primaryHeadingNodeId: idSchema,
        reducedMotion: z.literal("required"),
      })
      .strict(),
  })
  .strict()
  .superRefine((spec, context) => {
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
    if (nodes.length > 160) context.addIssue({ code: "custom", message: "Surface exceeds 160 trusted nodes", path: ["root"] });
    if (maxDepth > 12) context.addIssue({ code: "custom", message: "Surface tree exceeds depth 12", path: ["root"] });
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
      if (node.type === "decorative-region" && !regions.has(node.regionId)) context.addIssue({ code: "custom", message: `Missing decorative region: ${node.regionId}`, path: ["root"] });
      if ((node.type === "heading" || node.type === "text") && contentBindings.get(node.binding) !== "text") context.addIssue({ code: "custom", message: `Undeclared or incorrectly typed binding: ${node.binding}`, path: ["root"] });
      if (node.type === "fact-list" && contentBindings.get(node.binding) !== "facts") context.addIssue({ code: "custom", message: `Undeclared or incorrectly typed binding: ${node.binding}`, path: ["root"] });
      if (node.type === "project-list" && contentBindings.get(node.binding) !== "projects") context.addIssue({ code: "custom", message: `Undeclared or incorrectly typed binding: ${node.binding}`, path: ["root"] });
      if (node.type === "callout") for (const key of [node.titleBinding, node.bodyBinding]) if (contentBindings.get(key) !== "text") context.addIssue({ code: "custom", message: `Undeclared text binding: ${key}`, path: ["root"] });
      if (node.type === "media") {
        const declaration = mediaBindings.get(node.binding);
        if (!declaration || declaration.altKey !== node.altBinding || contentBindings.get(node.altBinding) !== "text") context.addIssue({ code: "custom", message: `Undeclared media binding: ${node.binding}`, path: ["root"] });
      }
    }
    for (const pair of renderedContrastPairs(spec.theme.colors)) if (contrastRatio(pair.foreground, pair.background) < 4.5) context.addIssue({ code: "custom", message: `${pair.label} contrast must be at least 4.5:1`, path: ["theme", "colors"] });
    const { focusInner, focusOuter } = spec.theme.colors;
    if (contrastRatio(focusInner, focusOuter) < 3) context.addIssue({ code: "custom", message: "Focus rings must contrast with each other by at least 3:1", path: ["theme", "colors"] });
    for (const [label, background] of renderedBackgrounds(spec.theme.colors)) if (Math.max(contrastRatio(focusInner, background), contrastRatio(focusOuter, background)) < 3) context.addIssue({ code: "custom", message: `At least one focus ring must contrast with ${label} by 3:1`, path: ["theme", "colors"] });
  });
}

const historicalSurfaceSpecSchema = createRecursiveSurfaceSpecSchema(HISTORICAL_DESIGN_POLICY_VERSION);
const activeSurfaceSpecSchema = createRecursiveSurfaceSpecSchema(DESIGN_POLICY_VERSION);

const MAX_SURFACE_SPEC_BYTES = 320_000;
const MAX_SURFACE_VALUE_DEPTH = 64;
const MAX_SURFACE_VALUES = 5_000;
const PREFLIGHT_REJECTED = Object.freeze({ __surfacePreflightRejected: true });

/**
 * Rejects structurally hostile input before Zod enters the recursive node
 * schema. This walk is iterative so even an attacker-controlled 3,000-level
 * object produces a normal validation failure instead of a stack overflow.
 */
function surfaceValuePassesPreflight(input: unknown): boolean {
  try {
    const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
    const seen = new WeakSet<object>();
    let values = 0;
    let estimatedBytes = 0;
    while (stack.length) {
      const { value, depth } = stack.pop()!;
      if (++values > MAX_SURFACE_VALUES || depth > MAX_SURFACE_VALUE_DEPTH) return false;
      if (typeof value === "string") {
        estimatedBytes += value.length * 2;
        if (estimatedBytes > MAX_SURFACE_SPEC_BYTES) return false;
        continue;
      }
      if (value === null || typeof value === "boolean") continue;
      if (typeof value === "number") {
        if (!Number.isFinite(value)) return false;
        continue;
      }
      if (typeof value !== "object") return false;
      const object = value as Record<string, unknown>;
      if (seen.has(object)) return false;
      seen.add(object);
      const keys = Object.keys(object);
      values += keys.length;
      if (values > MAX_SURFACE_VALUES) return false;
      for (const key of keys) {
        estimatedBytes += key.length * 2;
        if (estimatedBytes > MAX_SURFACE_SPEC_BYTES) return false;
        stack.push({ value: object[key], depth: depth + 1 });
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Active-version authoring schema. Read paths must use safeParseSurfaceSpec. */
export const surfaceSpecSchema = z.preprocess(
  (input) => surfaceValuePassesPreflight(input) ? input : PREFLIGHT_REJECTED,
  activeSurfaceSpecSchema,
);

export const SURFACE_POLICY_REGISTRY = Object.freeze({
  [HISTORICAL_DESIGN_POLICY_VERSION]: Object.freeze({
    version: HISTORICAL_DESIGN_POLICY_VERSION,
    designPolicyId: HISTORICAL_DESIGN_POLICY_ID,
    sourceHash: HISTORICAL_DESIGN_POLICY_SOURCE_HASH,
    policyJson: HISTORICAL_DESIGN_POLICY_SOURCE,
    parserVersion: "surface-spec-1",
    reading: "allowed",
    revisionCreation: "allowed",
  }),
  [DESIGN_POLICY_VERSION]: Object.freeze({
    version: DESIGN_POLICY_VERSION,
    designPolicyId: DESIGN_POLICY_ID,
    sourceHash: DESIGN_POLICY_SOURCE_HASH,
    policyJson: DESIGN_POLICY_SOURCE,
    parserVersion: "surface-spec-1",
    reading: "allowed",
    revisionCreation: "allowed",
  }),
} as const);

type SurfacePolicyVersion = keyof typeof SURFACE_POLICY_REGISTRY;
export type SurfaceSpec = z.infer<typeof historicalSurfaceSpecSchema> | z.infer<typeof activeSurfaceSpecSchema>;
export type SurfaceSpecParseResult = { success: true; data: SurfaceSpec } | { success: false; error: z.ZodError };

const policySchemas: Record<SurfacePolicyVersion, z.ZodType<SurfaceSpec>> = {
  "2026-07-14.1": historicalSurfaceSpecSchema,
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
    if (registered.reading !== "allowed") return failedSurfaceParse();
    if (options?.forRevisionCreation && registered.revisionCreation !== "allowed") return failedSurfaceParse();
    return policySchemas[version as SurfacePolicyVersion].safeParse(input) as SurfaceSpecParseResult;
  } catch {
    return failedSurfaceParse();
  }
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
  } catch {
    throw new Error("surface_spec_invalid");
  }
}

export { surfaceNodeSchema };

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateSurfaceContrast(spec: Pick<SurfaceSpec, "theme">): { passed: boolean; minimumRatio: number; minimumPair: string } {
  const results = renderedContrastPairs(spec.theme.colors).map((pair) => ({ ...pair, ratio: contrastRatio(pair.foreground, pair.background) }));
  const minimum = results.reduce((left, right) => left.ratio <= right.ratio ? left : right);
  return { passed: results.every((result) => result.ratio >= 4.5), minimumRatio: minimum.ratio, minimumPair: minimum.label };
}

export function renderedContrastPairs(colors: z.infer<typeof surfaceThemeSchema>["colors"]): Array<{ foreground: string; background: string; label: string }> {
  const projectPanel = mixHex(colors.surface, colors.ink, 0.96);
  return [
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
}

function renderedBackgrounds(colors: z.infer<typeof surfaceThemeSchema>["colors"]): Array<[string, string]> {
  return [["canvas", colors.canvas], ["panel", colors.surface], ["accent", colors.accent], ["project panel", mixHex(colors.surface, colors.ink, 0.96)]];
}

function mixHex(left: string, right: string, leftWeight: number): string {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) => Math.round(channel(left, offset) * leftWeight + channel(right, offset) * (1 - leftWeight)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
