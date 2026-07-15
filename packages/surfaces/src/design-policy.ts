export const DESIGN_POLICY_VERSION = "2026-07-15.2" as const;
export const DESIGN_POLICY_ID = "design_policy_2026_07_15_2" as const;
export const DESIGN_POLICY_ACTIVATED_AT = "2026-07-15T00:00:00.000Z" as const;
export const HISTORICAL_DESIGN_POLICY_VERSION = "2026-07-14.1" as const;
export const HISTORICAL_DESIGN_POLICY_ID = "design_policy_2026_07_14_1" as const;
export const HISTORICAL_DESIGN_POLICY_SOURCE_HASH = "02fb86561e6ea76ba8b093b7563f58ff9986343255375110e5e845dcd274951d" as const;

export const designPolicy = {
  id: DESIGN_POLICY_ID,
  version: DESIGN_POLICY_VERSION,
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
    "section",
    "stack",
    "grid",
    "heading",
    "text",
    "fact-list",
    "project-list",
    "media",
    "callout",
    "action-row",
    "decorative-region",
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
    htmlTags: [
      "article",
      "aside",
      "blockquote",
      "br",
      "div",
      "em",
      "figcaption",
      "figure",
      "h2",
      "h3",
      "h4",
      "li",
      "ol",
      "p",
      "section",
      "span",
      "strong",
      "ul",
    ],
    forbiddenCss: [
      "@import",
      "@font-face",
      "url()",
      "position: fixed",
      "position: sticky",
      "behavior",
      "-moz-binding",
      "content with a URL",
      "global selectors",
    ],
  },
  assets: {
    origin: "credentialless passive asset origin",
    approvedContentTypes: [
      "image/avif",
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    forbiddenContentTypes: ["text/html", "image/svg+xml", "application/javascript"],
    sniffingDisabled: true,
    contentDisposition: "inline for validated passive assets only",
  },
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
export const DESIGN_POLICY_SOURCE_HASH = "d233c412c0ce31ae9d1842d4a7f2ba4e25f5f85bbf66645ecea6eb3e62ba8f4f";

// Exact launch-candidate policy retained for validation of stored revisions.
// Font entries are historical interpretation metadata only; current upload and
// serving code remains raster-only.
export const HISTORICAL_DESIGN_POLICY_SOURCE = canonicalJson({
  ...designPolicy,
  id: HISTORICAL_DESIGN_POLICY_ID,
  version: HISTORICAL_DESIGN_POLICY_VERSION,
  assets: {
    ...designPolicy.assets,
    approvedContentTypes: [...designPolicy.assets.approvedContentTypes, "font/woff", "font/woff2"],
  },
});
