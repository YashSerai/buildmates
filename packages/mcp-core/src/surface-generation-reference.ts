import { DESIGN_POLICY_VERSION, safeParseSurfaceSpec, surfaceNodeSchema, type SurfaceNodeV2, type SurfaceSpecV2 } from "@buildmates/surfaces";
import { z } from "zod";

type JsonSchema = Record<string, unknown>;

export type SurfaceComponentReference = {
  contract: readonly string[];
  components: Record<string, { required: string[]; properties: Record<string, unknown> }>;
};

export function surfaceComponentReference(trustedComponents: readonly string[]): SurfaceComponentReference {
  const schema = z.toJSONSchema(surfaceNodeSchema) as JsonSchema;
  const variants = Array.isArray(schema.oneOf) ? schema.oneOf as JsonSchema[] : [];
  const trusted = new Set(trustedComponents);
  const components: SurfaceComponentReference["components"] = {};
  for (const variant of variants) {
    const properties = variant.properties as Record<string, JsonSchema> | undefined;
    const type = properties?.type?.const;
    if (typeof type !== "string" || !trusted.has(type)) continue;
    components[type] = {
      required: Array.isArray(variant.required) ? variant.required.filter((item): item is string => typeof item === "string") : [],
      properties: Object.fromEntries(Object.entries(properties ?? {}).map(([name, property]) => [name, compactProperty(property)])),
    };
  }
  return {
    contract: [
      "Every node is strict: include every required property and no unlisted property.",
      "Binding fields must use an authorized binding from this generation brief.",
      "Children accepts only complete nodes from this reference; split requires exactly two children.",
      "Use validate_surface_spec once before submission. On failure, repair exact paths; after two failures restart from customizedExample.",
    ],
    components,
  };
}

function compactProperty(schema: JsonSchema): unknown {
  if ("const" in schema) return [schema.const];
  if (Array.isArray(schema.enum)) return schema.enum;
  if (Array.isArray(schema.anyOf)) {
    const values = (schema.anyOf as JsonSchema[]).flatMap((item) => "const" in item ? [item.const] : item.type === "null" ? [null] : []);
    if (values.length === schema.anyOf.length) return values;
    return { oneOf: (schema.anyOf as JsonSchema[]).map(compactProperty) };
  }
  if (schema.$ref === "#") return "SurfaceNode";
  if (schema.type === "array") {
    const items = schema.items as JsonSchema | undefined;
    return { type: items?.$ref === "#" ? "SurfaceNode[]" : "array", ...(typeof schema.minItems === "number" ? { min: schema.minItems } : {}), ...(typeof schema.maxItems === "number" ? { max: schema.maxItems } : {}) };
  }
  if (schema.type === "object") {
    const properties = schema.properties as Record<string, JsonSchema> | undefined;
    return {
      type: "object",
      required: Array.isArray(schema.required) ? schema.required : [],
      properties: properties ? Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, compactProperty(property)])) : {},
    };
  }
  if (typeof schema.type === "string") {
    return { type: schema.type, ...(typeof schema.minimum === "number" ? { min: schema.minimum } : {}), ...(typeof schema.maximum === "number" ? { max: schema.maximum } : {}) };
  }
  return "value";
}

export function customizedProfileSurfaceExample(input: {
  starterSpec: unknown;
  authorizedBindingTypes: Record<string, unknown> | null;
  authorizedContent?: Record<string, unknown> | null;
  authorizedMedia?: Array<{ key: string; label: string; altKey: string; approvedAssetIds: string[] }>;
  approvedAssets?: Array<{ id: string; src: string }>;
  trustedComponents: readonly string[];
}): SurfaceSpecV2 | null {
  const parsedStarter = safeParseSurfaceSpec(input.starterSpec, DESIGN_POLICY_VERSION);
  if (!parsedStarter.success || parsedStarter.data.schemaVersion !== "2" || parsedStarter.data.kind !== "profile") return null;
  const trusted = new Set(input.trustedComponents);
  const requiredComponents = ["section", "stack", "heading", "text", "project-list", "fact-list"];
  if (requiredComponents.some((component) => !trusted.has(component))) return null;
  const typedBindings = Object.entries(input.authorizedBindingTypes ?? {});
  const textBindings = typedBindings.filter(([, type]) => type === "text").map(([key]) => key);
  const factsBinding = typedBindings.find(([, type]) => type === "facts")?.[0];
  const projectsBinding = typedBindings.find(([, type]) => type === "projects")?.[0];
  if (textBindings.length < 2 || !factsBinding || !projectsBinding) return null;
  const [nameBinding, summaryBinding] = textBindings;
  const headingId = "generated-profile-title";
  const root: SurfaceNodeV2 = {
    id: "generated-profile-root", type: "section", tone: "canvas", layout: "flow", padding: "none", bleed: true,
    minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
    children: [
      {
        id: "generated-identity-chapter", type: "section", tone: "canvas", layout: "hero", padding: "xl", bleed: true,
        minHeight: "half", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
        children: [
          { id: "generated-identity-stack", type: "stack", gap: "md", align: "start", justify: "center", width: "wide", children: [
            { id: headingId, type: "heading", level: 1, binding: nameBinding, fallback: "Builder profile", size: "display", align: "start", width: "balanced", weight: "bold", lineHeight: "snug", tracking: "normal" },
            { id: "generated-summary", type: "text", style: "lead", binding: summaryBinding, fallback: "Building useful systems.", align: "start", width: "prose", weight: "regular", lineHeight: "normal", tracking: "normal" },
          ] },
        ],
      },
      {
        id: "generated-projects-chapter", type: "section", tone: "surface", layout: "flow", padding: "lg", bleed: true,
        minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
        children: [
          { id: "generated-projects-stack", type: "stack", gap: "lg", align: "start", justify: "start", width: "full", children: [
            { id: "generated-projects", type: "project-list", binding: projectsBinding, emptyMessage: "", layout: "editorial", columns: 1 },
          ] },
        ],
      },
      {
        id: "generated-context-chapter", type: "section", tone: "canvas", layout: "flow", padding: "lg", bleed: true,
        minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
        children: [
          { id: "generated-facts", type: "fact-list", binding: factsBinding, emptyMessage: "", layout: "grid", emphasis: "quiet" },
        ],
      },
    ],
  };
  const spec: SurfaceSpecV2 = {
    ...parsedStarter.data,
    title: "Valid profile surface example",
    theme: {
      ...parsedStarter.data.theme,
      typography: { ...parsedStarter.data.theme.typography, display: "gallery-serif", scale: "generous", headingWeight: "black" },
      atmosphere: { motif: "none", density: "quiet", tone: "accent", continuity: "section" },
      motion: { preset: "none", durationMs: 400, iterations: 1 },
    },
    root,
    bindingManifest: {
      content: [
        { key: nameBinding, type: "text" }, { key: summaryBinding, type: "text" },
        { key: factsBinding, type: "facts" }, { key: projectsBinding, type: "projects" },
      ],
      media: [],
    },
    approvedAssets: [], decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "full", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
    accessibility: { label: "Customized builder profile", primaryHeadingNodeId: headingId, reducedMotion: "required" },
  };
  const validation = safeParseSurfaceSpec(spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
  return validation.success ? spec : null;
}
