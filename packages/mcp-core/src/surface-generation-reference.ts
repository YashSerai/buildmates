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
      "For profile pages, author one complete semantic HTML fragment and one complete responsive CSS stylesheet. Do not compose Buildmates components.",
      "HTML is a body fragment with exactly one h1. JavaScript, forms, embedded documents, inline event handlers, SVG, and arbitrary network requests are forbidden. Links use HTTPS, target _blank, and rel noopener noreferrer.",
      "Render current public data with {{binding.key}}. Render arrays with <template data-buildmates-repeat=\"binding.key\"> and item tokens such as {{item.title}}, {{item.summary}}, {{item.href}}, {{item.label}}, and {{item.value}}.",
      "Every declared content binding must appear. Images may use only exact approvedAssets src paths. CSS url() values may use only those same paths.",
      "Include real desktop and phone layout rules plus @media (prefers-reduced-motion: reduce). Content must be visible without animation.",
      "Generated profiles are continuous auto-height documents. Do not size page sections with vh, svh, lvh, or dvh; use content sizing, rem, px, percentages of width, or width-based clamp values so the iframe cannot manufacture empty vertical space.",
      "The saved desktop and phone dimensions are representative QA checkpoints and initial loading estimates, not fixed canvases. The page must reflow fluidly at every intermediate and larger viewport width.",
      "Use validate_surface_spec once before submission. Repair exact returned paths rather than reducing the design to a preset.",
    ],
    html: {
      allowedTags: ["a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "cite", "code", "dd", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "li", "main", "mark", "nav", "ol", "p", "picture", "pre", "q", "section", "small", "span", "strong", "sub", "summary", "sup", "template", "time", "ul"],
      forbidden: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "meta", "link", "base", "svg", "canvas", "audio", "video", "on* event attributes"],
      maximumCharacters: 180000,
    },
    css: { maximumCharacters: 180000, forbidden: ["@import", "@font-face", "expression()", "behavior", "-moz-binding", "unapproved url()"], arbitrarySelectorsAndLayout: true, cssOnlyMotion: true },
    bindings: { scalar: "{{profile.displayName}}", collection: "<template data-buildmates-repeat=\"profile.projects\"><article><h2>{{item.title}}</h2><p>{{item.summary}}</p></article></template>" },
  };
}

export function customizedProfileSurfaceExample(input: {
  authorizedBindingTypes: Record<string, unknown> | null;
  approvedAssets?: Array<{ id: string; src: string }>;
} & Record<string, unknown>): SurfaceSpecV3 | null {
  const entries = Object.entries(input.authorizedBindingTypes ?? {});
  const text = entries.filter(([, type]) => type === "text").map(([key]) => key);
  const projects = entries.find(([, type]) => type === "projects")?.[0];
  const facts = entries.find(([, type]) => type === "facts")?.[0];
  if (text.length < 2 || !projects || !facts) return null;
  const [name, summary] = text;
  const spec: SurfaceSpecV3 = {
    schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "Generated profile recovery example",
    document: {
      html: `<main class="page"><header><h1>{{${name}}}</h1><p>{{${summary}}}</p></header><section><template data-buildmates-repeat="${projects}"><article><h2>{{item.title}}</h2><p>{{item.summary}}</p></article></template></section><dl><template data-buildmates-repeat="${facts}"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></main>`,
      css: `:root{color-scheme:light}.page{max-width:72rem;margin:auto;padding:clamp(1.25rem,5vw,5rem);font-family:system-ui,sans-serif;color:#171914;background:#f7f4ec}.page h1{font-size:clamp(3rem,9vw,8rem);line-height:.9}.page section{display:grid;gap:1rem}.page article{border-top:1px solid #4d5148;padding:1.5rem 0}@media(max-width:600px){.page{padding:1rem}.page h1{font-size:clamp(2.6rem,16vw,5rem)}}@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}`,
    },
    bindingManifest: { content: [{ key: name, type: "text" }, { key: summary, type: "text" }, { key: projects, type: "projects" }, { key: facts, type: "facts" }], media: [] },
    approvedAssets: input.approvedAssets ?? [], responsive: { desktopMinHeight: 1100, phoneMinHeight: 1400 }, accessibility: { label: "Generated builder profile", reducedMotion: "required" },
  };
  const parsed = safeParseSurfaceSpec(spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
  return parsed.success && parsed.data.schemaVersion === "3" ? parsed.data : null;
}

// Retained for room and Circle tooling that still exposes the v2 component grammar.
export function legacySurfaceNodeJsonSchema(): JsonSchema { return z.toJSONSchema(surfaceNodeSchema) as JsonSchema; }
