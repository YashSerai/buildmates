export const DESIGN_POLICY_VERSION = "2026-07-21.2" as const;
export const DESIGN_POLICY_ID = "design_policy_2026_07_21_2" as const;
export const DESIGN_POLICY_ACTIVATED_AT = "2026-07-21T00:00:00.000Z" as const;

export const PROFILE_V3_DESIGN_POLICY_VERSION = "2026-07-20.1" as const;
export const PROFILE_V3_DESIGN_POLICY_ID = "design_policy_2026_07_20_1" as const;
export const PROFILE_V3_DESIGN_POLICY_SOURCE_HASH = "7e508c4d83c24ab47d4ade3736874697e95a5338bda09201b8f5d545968ad81f" as const;

export const COMPONENT_V2_DESIGN_POLICY_VERSION = "2026-07-18.2" as const;
export const COMPONENT_V2_DESIGN_POLICY_ID = "design_policy_2026_07_18_2" as const;
export const COMPONENT_V2_DESIGN_POLICY_SOURCE_HASH = "65f3b84e0ffff1cf63022afbf2bcce8d4fff44e5ad654b5e89338e34971af284" as const;

export const PRIOR_ACTIVE_DESIGN_POLICY_VERSION = "2026-07-18.1" as const;
export const PRIOR_ACTIVE_DESIGN_POLICY_ID = "design_policy_2026_07_18_1" as const;
export const PRIOR_ACTIVE_DESIGN_POLICY_SOURCE_HASH = "dbc6b5e1a8b37b4cf0dfa644680d571b4b09d852206ac817839552e73eb6cc5b" as const;

export const LEGACY_V2_DESIGN_POLICY_VERSION = "2026-07-17.4" as const;
export const LEGACY_V2_DESIGN_POLICY_ID = "design_policy_2026_07_17_4" as const;
export const LEGACY_V2_DESIGN_POLICY_SOURCE_HASH = "ffb40e9bcd1d041561d469fb73f57fc7c21dce353355c04772323a2cf6ce3303" as const;

export const PREVIOUS_DESIGN_POLICY_VERSION = "2026-07-15.2" as const;
export const PREVIOUS_DESIGN_POLICY_ID = "design_policy_2026_07_15_2" as const;
export const PREVIOUS_DESIGN_POLICY_SOURCE_HASH = "d233c412c0ce31ae9d1842d4a7f2ba4e25f5f85bbf66645ecea6eb3e62ba8f4f" as const;
export const HISTORICAL_DESIGN_POLICY_VERSION = "2026-07-14.1" as const;
export const HISTORICAL_DESIGN_POLICY_ID = "design_policy_2026_07_14_1" as const;
export const HISTORICAL_DESIGN_POLICY_SOURCE_HASH = "02fb86561e6ea76ba8b093b7563f58ff9986343255375110e5e845dcd274951d" as const;

const previousDesignPolicy = {
  id: PREVIOUS_DESIGN_POLICY_ID,
  version: PREVIOUS_DESIGN_POLICY_VERSION,
  status: "active",
  purpose:
    "Permit expressive builder surfaces while keeping identity, data access, navigation, and product actions in trusted Buildmates code.",
  authority: {
    generatedCodeMay: [
      "choose approved theme tokens",
      "compose trusted surface primitives",
      "bind only server-resolved fields listed in the generation brief",
      "supply isolated decorative or editorial markup",
    ],
    generatedCodeMustNever: [
      "read credentials or raw connector context",
      "execute scripts or submit forms",
      "change permissions, privacy, identity, or governance",
      "navigate the top-level application",
      "make network requests",
      "render a product action inside an untrusted region",
    ],
  },
  trustedComponents: [
    "section", "stack", "grid", "heading", "text", "fact-list", "project-list",
    "media", "callout", "action-row", "decorative-region",
  ],
  content: {
    bindingOnly: true,
    privateFieldsAreNeverInjected: true,
    userTextIsRenderedAsText: true,
    maximumTreeDepth: 12,
    maximumNodes: 160,
    maximumTextLength: 320,
  },
  accessibility: {
    headingOrderRequired: true,
    onePrimaryHeading: true,
    mediaAltRequired: true,
    focusVisibleRequired: true,
    minimumTouchTargetCssPixels: 44,
    reducedMotionFallbackRequired: true,
    contentVisibleWithoutMotion: true,
  },
  decorativeRegions: {
    credentiallessIframe: true,
    sandboxTokens: [],
    scripts: false,
    forms: false,
    sameOrigin: false,
    popups: false,
    topNavigation: false,
    downloads: false,
    htmlTags: ["article", "aside", "blockquote", "br", "div", "em", "figcaption", "figure", "h2", "h3", "h4", "li", "ol", "p", "section", "span", "strong", "ul"],
    forbiddenCss: ["@import", "@font-face", "url()", "position: fixed", "position: sticky", "behavior", "-moz-binding", "content with a URL", "global selectors"],
  },
  assets: {
    origin: "credentialless passive asset origin",
    approvedContentTypes: ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"],
    forbiddenContentTypes: ["text/html", "image/svg+xml", "application/javascript"],
    sniffingDisabled: true,
    contentDisposition: "inline for validated passive assets only",
  },
} as const;

const legacyV2DesignPolicy = {
  ...previousDesignPolicy,
  id: LEGACY_V2_DESIGN_POLICY_ID,
  version: LEGACY_V2_DESIGN_POLICY_VERSION,
  status: "active",
  purpose:
    "Enable portfolio-level, full-page builder profiles through governed composition without giving generated code authority over identity, data, navigation, or execution.",
  authority: {
    ...previousDesignPolicy.authority,
    generatedCodeMay: [
      "choose approved palette, typography, texture, shape, density, and motion tokens",
      "compose responsive full-page sections, editorial splits, bento grids, galleries, frames, clusters, and decorative marks",
      "bind only server-resolved fields listed in the generation brief",
      "use only identity-bound raster assets explicitly approved for the Surface",
      "supply isolated decorative or editorial markup",
    ],
  },
  trustedComponents: [
    "section", "stack", "grid", "split", "cluster", "frame", "heading", "text",
    "fact-list", "tag-list", "project-list", "media", "gallery", "callout", "divider",
    "spacer", "decorative-mark", "action-row", "decorative-region",
  ],
  content: {
    ...previousDesignPolicy.content,
    maximumTreeDepth: 14,
    maximumNodes: 240,
  },
  responsive: {
    containerQueries: true,
    mobileContentOrderPreserved: true,
    contentMayNeverBeHiddenByBreakpoint: true,
    fullBleedSectionsUseTrustedGutters: true,
  },
  visualAuthority: {
    arbitraryCss: false,
    arbitraryClassNames: false,
    tokenizedBackgrounds: ["solid", "gradient", "radial", "paper", "grid", "stripes"],
    tokenizedMotionOnly: true,
    contentVisibleWithoutMotion: true,
  },
} as const;

const priorActiveDesignPolicy = {
  ...legacyV2DesignPolicy,
  id: PRIOR_ACTIVE_DESIGN_POLICY_ID,
  version: PRIOR_ACTIVE_DESIGN_POLICY_VERSION,
  authority: {
    ...legacyV2DesignPolicy.authority,
    generatedCodeMay: [
      ...legacyV2DesignPolicy.authority.generatedCodeMay,
      "compose trusted project-specific visual artifacts from approved project bindings",
    ],
  },
  trustedComponents: [...legacyV2DesignPolicy.trustedComponents, "project-artifact"],
} as const;

const componentV2DesignPolicy = {
  ...priorActiveDesignPolicy,
  id: COMPONENT_V2_DESIGN_POLICY_ID,
  version: COMPONENT_V2_DESIGN_POLICY_VERSION,
  trustedComponents: [...priorActiveDesignPolicy.trustedComponents, "featured-project"],
} as const;

const profileV3DesignPolicy = {
  ...componentV2DesignPolicy,
  id: PROFILE_V3_DESIGN_POLICY_ID,
  version: PROFILE_V3_DESIGN_POLICY_VERSION,
  purpose: "Publish complete Codex-authored HTML and CSS profiles without giving generated documents authority over identity, private data, application controls, or execution.",
  authority: {
    generatedCodeMay: [
      "author a complete semantic HTML document fragment and responsive CSS",
      "choose the full information architecture, visual language, typography, layout, and CSS-only motion",
      "bind only server-resolved public fields listed in the generation brief",
      "use only identity-bound raster assets explicitly approved for the Surface",
    ],
    generatedCodeMustNever: [
      "execute JavaScript, submit forms, read cookies, storage, credentials, or raw connector context",
      "change permissions, privacy, identity, governance, or trusted Buildmates controls",
      "make arbitrary network requests or embed active third-party content",
      "place private fields in markup and hide them with CSS",
    ],
  },
  profileFormat: "generated-site-bundle-v3",
  // Retained only for room and Circle compatibility. Profile generation uses
  // generated-site-bundle-v3 and is never instructed to compose these.
  trustedComponents: [...componentV2DesignPolicy.trustedComponents],
  generatedDocument: {
    sandboxedIframe: true,
    scripts: false,
    forms: false,
    arbitraryNetworkRequests: false,
    cssOnlyMotion: true,
    currentPublicBindingsOnly: true,
    targetedRevisionPreservesUnrelatedSource: true,
    externalLinksOpenSafely: true,
    frameHeightTracksRenderedDocument: true,
  },
} as const;

export const designPolicy = {
  ...profileV3DesignPolicy,
  id: DESIGN_POLICY_ID,
  version: DESIGN_POLICY_VERSION,
  purpose: "Publish complete Codex-authored HTML and CSS for profiles, shared rooms, and Circles without giving generated documents authority over identity, private data, application controls, or execution.",
  generatedSiteFormats: ["profile", "room", "circle"],
} as const;

export type DesignPolicy = typeof designPolicy;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("Design policy contains a non-JSON value");
  return encoded;
}

export const DESIGN_POLICY_SOURCE = canonicalJson(designPolicy);
// SHA-256 of DESIGN_POLICY_SOURCE. The seed test recomputes this value.
export const DESIGN_POLICY_SOURCE_HASH = "bd2980329a50fed9eb790c59e76eff825e2a4ee03a115b91c99134f5df45978b";

export const PROFILE_V3_DESIGN_POLICY_SOURCE = canonicalJson(profileV3DesignPolicy);

export const COMPONENT_V2_DESIGN_POLICY_SOURCE = canonicalJson(componentV2DesignPolicy);

export const PRIOR_ACTIVE_DESIGN_POLICY_SOURCE = canonicalJson(priorActiveDesignPolicy);

export const LEGACY_V2_DESIGN_POLICY_SOURCE = canonicalJson(legacyV2DesignPolicy);

export const PREVIOUS_DESIGN_POLICY_SOURCE = canonicalJson(previousDesignPolicy);
// Exact launch-candidate policy retained for validation of stored revisions.
// Font entries are historical interpretation metadata only; current upload and
// serving code remains raster-only.
export const HISTORICAL_DESIGN_POLICY_SOURCE = canonicalJson({
  ...previousDesignPolicy,
  id: HISTORICAL_DESIGN_POLICY_ID,
  version: HISTORICAL_DESIGN_POLICY_VERSION,
  assets: {
    ...previousDesignPolicy.assets,
    approvedContentTypes: [...previousDesignPolicy.assets.approvedContentTypes, "font/woff", "font/woff2"],
  },
});
