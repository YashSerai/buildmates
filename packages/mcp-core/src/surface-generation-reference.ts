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
  trustedComponents: readonly string[];
}): SurfaceSpecV2 | null {
  const parsedStarter = safeParseSurfaceSpec(input.starterSpec, DESIGN_POLICY_VERSION);
  if (!parsedStarter.success || parsedStarter.data.schemaVersion !== "2" || parsedStarter.data.kind !== "profile") return null;
  const trusted = new Set(input.trustedComponents);
  const requiredComponents = ["section", "stack", "split", "frame", "heading", "text", "fact-list", "project-list", "divider", "decorative-mark"];
  if (requiredComponents.some((component) => !trusted.has(component))) return null;
  const typedBindings = Object.entries(input.authorizedBindingTypes ?? {});
  const textBindings = typedBindings.filter(([, type]) => type === "text").map(([key]) => key);
  const factsBinding = typedBindings.find(([, type]) => type === "facts")?.[0];
  const projectsBinding = typedBindings.find(([, type]) => type === "projects")?.[0];
  if (textBindings.length < 2 || !factsBinding || !projectsBinding) return null;
  const [nameBinding, summaryBinding] = textBindings;
  const headingId = "generated-profile-title";
  const root: SurfaceNodeV2 = {
    id: "generated-profile-root", type: "section", tone: "canvas", layout: "hero", padding: "xl", bleed: true,
    minHeight: "viewport", background: "spotlight", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
    children: [{
      id: "generated-profile-stack", type: "stack", gap: "xl", align: "start", justify: "between", width: "full", children: [
        { id: "generated-signature", type: "decorative-mark", mark: "orbit", size: "xl", position: "top-right", tone: "highlight" },
        { id: "generated-eyebrow", type: "text", style: "eyebrow", binding: summaryBinding, fallback: "Independent builder", align: "start", width: "narrow", weight: "bold", lineHeight: "snug", tracking: "wide" },
        { id: headingId, type: "heading", level: 1, binding: nameBinding, fallback: "Builder profile", size: "hero", align: "start", width: "balanced", weight: "black", lineHeight: "tight", tracking: "tight" },
        { id: "generated-rule", type: "divider", style: "stamp" },
        { id: "generated-intro", type: "split", ratio: "2-1", gap: "xl", align: "start", reverseOnMobile: true, children: [
          { id: "generated-summary-frame", type: "frame", tone: "surface", padding: "lg", border: "hairline", elevation: "directional", rotation: "none", span: 2, children: [
            { id: "generated-summary", type: "text", style: "lead", binding: summaryBinding, fallback: "Building useful systems.", align: "start", width: "prose", weight: "regular", lineHeight: "relaxed", tracking: "normal" },
            { id: "generated-projects", type: "project-list", binding: projectsBinding, emptyMessage: "Projects will appear here.", layout: "editorial", columns: 1 },
          ] },
          { id: "generated-facts-frame", type: "frame", tone: "accent", padding: "lg", border: "strong", elevation: "tonal", rotation: "right", span: 1, children: [
            { id: "generated-facts", type: "fact-list", binding: factsBinding, emptyMessage: "Details will appear here.", layout: "rail", emphasis: "strong" },
          ] },
        ] },
      ],
    }],
  };
  const spec: SurfaceSpecV2 = {
    ...parsedStarter.data,
    title: "Customized builder profile",
    theme: {
      ...parsedStarter.data.theme,
      typography: { ...parsedStarter.data.theme.typography, display: "gallery-serif", scale: "generous", headingWeight: "black" },
      atmosphere: { motif: "orbit", density: "present", tone: "highlight", continuity: "page" },
      motion: { preset: "drift", durationMs: 8_000, iterations: 2 },
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
  return safeParseSurfaceSpec(spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true }).success ? spec : null;
}
