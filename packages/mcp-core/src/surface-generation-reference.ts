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
  const requiredComponents = ["section", "stack", "split", "frame", "heading", "text", "fact-list", "project-list", "featured-project", "project-artifact", "divider", "decorative-mark", ...(input.authorizedMedia?.length ? ["media"] : [])];
  if (requiredComponents.some((component) => !trusted.has(component))) return null;
  const typedBindings = Object.entries(input.authorizedBindingTypes ?? {});
  const textBindings = typedBindings.filter(([, type]) => type === "text").map(([key]) => key);
  const factsBinding = typedBindings.find(([, type]) => type === "facts")?.[0];
  const projectsBinding = typedBindings.find(([, type]) => type === "projects")?.[0];
  if (textBindings.length < 2 || !factsBinding || !projectsBinding) return null;
  const projects = input.authorizedContent?.[projectsBinding];
  const projectItems = Array.isArray(projects) ? projects.slice(0, 12) : [];
  const projectCount = Math.max(1, projectItems.length);
  const mediaForProject = (index: number) => {
    const title = projectItems[index] && typeof projectItems[index] === "object" ? String((projectItems[index] as Record<string, unknown>).title ?? "") : "";
    return input.authorizedMedia?.find((item) => item.label === `${title} image`) ?? input.authorizedMedia?.[index];
  };
  const usedMedia = Array.from({ length: projectCount }, (_, index) => mediaForProject(index)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const artifactVariants = ["orbit-map", "stacked-planes", "type-field", "signal-path"] as const;
  const projectChapters: SurfaceNodeV2[] = Array.from({ length: projectCount }, (_, index) => {
    const media = mediaForProject(index);
    const visual: SurfaceNodeV2 = media ? {
      id: `generated-project-${index + 1}-visual`, type: "frame", tone: "transparent", padding: "none", border: "none", elevation: "none", rotation: "none", span: 1,
      children: [
        { id: `generated-project-${index + 1}-media`, type: "media", binding: media.key, altBinding: media.altKey, aspect: "landscape", fit: "cover", focalPoint: "center", treatment: index % 2 === 0 ? "plain" : "offset" },
        { id: `generated-project-${index + 1}-artifact`, type: "project-artifact", binding: projectsBinding, index, variant: artifactVariants[index % artifactVariants.length], tone: index % 2 === 0 ? "accent" : "ink", scale: "medium" },
      ],
    } : { id: `generated-project-${index + 1}-artifact`, type: "project-artifact", binding: projectsBinding, index, variant: artifactVariants[index % artifactVariants.length], tone: index % 2 === 0 ? "accent" : "ink", scale: "large" };
    const detail: SurfaceNodeV2 = { id: `generated-project-${index + 1}-detail`, type: "featured-project", binding: projectsBinding, index, layout: index % 2 === 0 ? "media-left" : "media-right", showTags: true, showMetrics: true };
    return {
      id: `generated-project-${index + 1}-chapter`, type: "section", tone: index % 2 === 0 ? "canvas" : "secondary", layout: "flow", padding: "lg", bleed: true,
      minHeight: "half", background: index % 2 === 0 ? "solid" : "wash", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
      children: [{ id: `generated-project-${index + 1}-split`, type: "split", ratio: "1-1", gap: "xl", align: "center", reverseOnMobile: index % 2 === 1, children: [detail, visual] }],
    };
  });
  const [nameBinding, summaryBinding] = textBindings;
  const headingId = "generated-profile-title";
  const root: SurfaceNodeV2 = {
    id: "generated-profile-root", type: "section", tone: "canvas", layout: "flow", padding: "none", bleed: true,
    minHeight: "auto", background: "solid", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
    children: [
      {
        id: "generated-identity-chapter", type: "section", tone: "canvas", layout: "hero", padding: "xl", bleed: true,
        minHeight: "viewport", background: "spotlight", backgroundMediaBinding: usedMedia[0]?.key ?? null, backgroundMediaOpacity: usedMedia.length ? "medium" : "subtle", backgroundMediaFocalPoint: "center",
        children: [
          { id: "generated-identity-stack", type: "stack", gap: "xl", align: "start", justify: "between", width: "full", children: [
            { id: "generated-signature", type: "decorative-mark", mark: "orbit", size: "xl", position: "top-right", tone: "highlight" },
            { id: "generated-eyebrow", type: "text", style: "eyebrow", binding: summaryBinding, fallback: "Independent builder", align: "start", width: "narrow", weight: "bold", lineHeight: "snug", tracking: "wide" },
            { id: headingId, type: "heading", level: 1, binding: nameBinding, fallback: "Builder profile", size: "hero", align: "start", width: "balanced", weight: "black", lineHeight: "tight", tracking: "tight" },
            { id: "generated-rule", type: "divider", style: "stamp" },
            { id: "generated-identity-split", type: "split", ratio: "2-1", gap: "xl", align: "stretch", reverseOnMobile: true, children: [
              { id: "generated-summary-frame", type: "frame", tone: "surface", padding: "lg", border: "hairline", elevation: "directional", rotation: "none", span: 2, children: [
                { id: "generated-summary", type: "text", style: "lead", binding: summaryBinding, fallback: "Building useful systems.", align: "start", width: "prose", weight: "regular", lineHeight: "relaxed", tracking: "normal" },
              ] },
              { id: "generated-lead-artifact", type: "project-artifact", binding: projectsBinding, index: 0, variant: "orbit-map", tone: "secondary", scale: "large" },
            ] },
          ] },
        ],
      },
      {
        id: "generated-projects-chapter", type: "section", tone: "surface", layout: "flow", padding: "xl", bleed: true,
        minHeight: "half", background: "paper-rule", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
        children: [
          { id: "generated-projects-stack", type: "stack", gap: "lg", align: "start", justify: "start", width: "full", children: [
            { id: "generated-projects", type: "project-list", binding: projectsBinding, emptyMessage: "No projects are shared on this profile.", layout: "editorial", columns: 1 },
          ] },
        ],
      },
      ...projectChapters,
      {
        id: "generated-context-chapter", type: "section", tone: "accent", layout: "band", padding: "xl", bleed: true,
        minHeight: "half", background: "wash", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center",
        children: [
          { id: "generated-context-frame", type: "frame", tone: "transparent", padding: "lg", border: "strong", elevation: "tonal", rotation: "none", span: 1, children: [
            { id: "generated-facts", type: "fact-list", binding: factsBinding, emptyMessage: "No additional profile details are shared.", layout: "grid", emphasis: "strong" },
          ] },
        ],
      },
    ],
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
        ...Array.from(new Set(usedMedia.map((item) => item.altKey))).filter((key) => ![nameBinding, summaryBinding, factsBinding, projectsBinding].includes(key)).map((key) => ({ key, type: "text" as const })),
      ],
      media: usedMedia.map((item) => ({ key: item.key, altKey: item.altKey, approvedAssetIds: [...item.approvedAssetIds], authorization: "surface-approved" as const })),
    },
    approvedAssets: (input.approvedAssets ?? []).filter((asset) => usedMedia.some((item) => item.approvedAssetIds.includes(asset.id))), decorativeRegions: [],
    responsive: { collapseGridsBelow: "md", contentWidth: "full", edgePadding: "comfortable", heroStackBelow: "md", preserveContentOrder: true },
    accessibility: { label: "Customized builder profile", primaryHeadingNodeId: headingId, reducedMotion: "required" },
  };
  const validation = safeParseSurfaceSpec(spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
  return validation.success ? spec : null;
}
