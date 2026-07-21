import { DESIGN_POLICY_VERSION, safeParseSurfaceSpec, surfaceNodeSchema, type SurfaceSpecV3 } from "@buildmates/surfaces";
import { z } from "zod";

type JsonSchema = Record<string, unknown>;

export type SurfaceComponentReference = {
  contract: readonly string[];
  format: string;
  html: Record<string, unknown>;
  css: Record<string, unknown>;
  bindings: Record<string, unknown>;
};

export function surfaceComponentReference(trustedComponents: readonly string[]): SurfaceComponentReference {
  void trustedComponents;
  return {
    format: "GeneratedSiteBundle v3",
    contract: [
      "For profiles, rooms, and Circles, author one complete semantic HTML fragment and one complete responsive CSS stylesheet. Do not compose Buildmates components.",
      "HTML is a body fragment with exactly one h1. JavaScript, forms, embedded documents, inline event handlers, SVG, and arbitrary network requests are forbidden. Links use HTTPS, target _blank, and rel noopener noreferrer.",
      "Render current public data with {{binding.key}}. Render arrays with <template data-buildmates-repeat=\"binding.key\"> and item tokens such as {{item.title}}, {{item.summary}}, {{item.href}}, {{item.label}}, and {{item.value}}.",
      "Every declared content binding must appear. Images may use only exact approvedAssets src paths. CSS url() values may use only those same paths.",
      "Include real desktop and phone layout rules plus @media (prefers-reduced-motion: reduce). Content must be visible without animation.",
      "Generated surfaces are continuous auto-height documents. Do not size page sections with vh, svh, lvh, or dvh; use content sizing, rem, px, percentages of width, or width-based clamp values so the iframe cannot manufacture empty vertical space.",
      "For rooms and Circles, generated HTML/CSS controls presentation only. Chat, membership, permissions, approvals, safety actions, scheduling, and shared-tool behavior remain trusted Buildmates controls outside the document.",
      "The saved desktop and phone dimensions are representative QA checkpoints and initial loading estimates, not fixed canvases. The page must reflow fluidly at every intermediate and larger viewport width.",
      "Use validate_surface_spec once before submission. Repair exact returned paths rather than reducing the design to a preset.",
    ],
    html: {
      allowedTags: ["a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "cite", "code", "dd", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "li", "main", "mark", "nav", "ol", "p", "picture", "pre", "q", "section", "small", "span", "strong", "sub", "summary", "sup", "template", "time", "ul"],
      forbidden: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "meta", "link", "base", "svg", "canvas", "audio", "video", "on* event attributes"],
      maximumCharacters: 180000,
    },
    css: { maximumCharacters: 180000, forbidden: ["@import", "@font-face", "expression()", "behavior", "-moz-binding", "unapproved url()"], arbitrarySelectorsAndLayout: true, cssOnlyMotion: true },
    bindings: { scalar: "{{profile.displayName}}", collection: "<template data-buildmates-repeat=\"circle.members\"><article><h2>{{item.label}}</h2><p>{{item.value}}</p></article></template>" },
  };
}

export function customizedSurfaceExample(input: {
  kind: "profile" | "room" | "circle";
  authorizedBindingTypes: Record<string, unknown> | null;
  authorizedMedia?: Array<{ key: string; altKey: string; approvedAssetIds: string[] }>;
  approvedAssets?: Array<{ id: string; src: string }>;
} & Record<string, unknown>): SurfaceSpecV3 | null {
  const entries = Object.entries(input.authorizedBindingTypes ?? {});
  const text = entries.filter(([, type]) => type === "text").map(([key]) => key);
  if (text.length < 2) return null;
  const [name, summary] = text;
  const approvedAssets = input.approvedAssets ?? [];
  const approvedById = new Map(approvedAssets.map((asset) => [asset.id, asset]));
  const media = (input.authorizedMedia ?? []).flatMap((binding) => {
    const assetIds = binding.approvedAssetIds.filter((id) => approvedById.has(id));
    return assetIds.length ? [{ key: binding.key, altKey: binding.altKey, approvedAssetIds: assetIds, authorization: "surface-approved" as const }] : [];
  });
  const mediaAltKeys = new Set(media.map((binding) => binding.altKey));
  const supportingTextMarkup = text.slice(2).filter((key) => !mediaAltKeys.has(key)).map((key) => `<p>{{${key}}}</p>`).join("");
  const mediaMarkup = media.map((binding) => {
    const asset = approvedById.get(binding.approvedAssetIds[0])!;
    return `<figure><img src="${asset.src}" alt="{{${binding.altKey}}}" loading="lazy" decoding="async"></figure>`;
  }).join("");
  const collections = entries.filter(([, type]) => ["projects", "facts", "strings"].includes(String(type)));
  const collectionMarkup = collections.map(([key, type]) => type === "projects"
    ? `<section><template data-buildmates-repeat="${key}"><article><h2>{{item.title}}</h2><p>{{item.summary}}</p></article></template></section>`
    : type === "facts"
      ? `<dl><template data-buildmates-repeat="${key}"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl>`
      : `<ul><template data-buildmates-repeat="${key}"><li>{{item.value}}</li></template></ul>`).join("");
  const content = entries.flatMap(([key, type]) => ["text", "facts", "projects", "strings"].includes(String(type))
    ? [{ key, type: type as "text" | "facts" | "projects" | "strings" }]
    : []);
  const spec: SurfaceSpecV3 = {
    schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: input.kind, title: `Generated ${input.kind} recovery example`,
    document: {
      html: `<main class="page"><header><h1>{{${name}}}</h1><p>{{${summary}}}</p>${supportingTextMarkup}</header>${mediaMarkup}${collectionMarkup}</main>`,
      css: `:root{color-scheme:light}.page{max-width:72rem;margin:auto;padding:clamp(1.25rem,5vw,5rem);font-family:system-ui,sans-serif;color:#171914;background:#f7f4ec}.page h1{font-size:clamp(3rem,9vw,8rem);line-height:.9}.page section{display:grid;gap:1rem}.page article{border-top:1px solid #4d5148;padding:1.5rem 0}@media(max-width:600px){.page{padding:1rem}.page h1{font-size:clamp(2.6rem,16vw,5rem)}}@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}`,
    },
    bindingManifest: { content, media },
    approvedAssets: approvedAssets.filter((asset) => media.some((binding) => binding.approvedAssetIds.includes(asset.id))), responsive: { desktopMinHeight: 900, phoneMinHeight: 1000 }, accessibility: { label: `Generated ${input.kind} surface`, reducedMotion: "required" },
  };
  const parsed = safeParseSurfaceSpec(spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
  return parsed.success && parsed.data.schemaVersion === "3" ? parsed.data : null;
}

export function customizedProfileSurfaceExample(input: { authorizedBindingTypes: Record<string, unknown> | null; approvedAssets?: Array<{ id: string; src: string }> } & Record<string, unknown>): SurfaceSpecV3 | null {
  return customizedSurfaceExample({ ...input, kind: "profile" });
}

// Retained for room and Circle tooling that still exposes the v2 component grammar.
export function legacySurfaceNodeJsonSchema(): JsonSchema { return z.toJSONSchema(surfaceNodeSchema) as JsonSchema; }
