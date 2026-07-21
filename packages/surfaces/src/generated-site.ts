type SurfaceFact = { label: string; value: string };
type SurfaceProject = { id: string; title: string; summary: string; href?: string; tags?: readonly string[]; metrics?: readonly SurfaceFact[] };
type SurfaceBinding = string | readonly string[] | readonly SurfaceFact[] | readonly SurfaceProject[] | { assetId: string; alt: string } | null;
type SurfaceBindings = Readonly<Record<string, SurfaceBinding | undefined>>;

const SAFE_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "b", "blockquote", "br", "cite", "code", "dd", "details", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "li", "main", "mark", "nav", "ol", "p", "picture", "pre", "q", "section", "small", "span", "strong", "sub", "summary", "sup", "template", "time", "ul",
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
const FORBIDDEN_SOURCE = /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|base|svg|math|video|audio|canvas)\b|\bon[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html/i;
const ASSET_PATH = /^\/api\/surface-assets\/[a-z0-9_-]+\/[a-f0-9]{64}\.(?:avif|gif|jpe?g|png|webp)$/i;
const BINDING_TOKEN = /\{\{\s*([a-z][a-z0-9_.-]{0,95}|item\.(?:label|value|id|title|summary|href|tags|metrics))\s*\}\}/gi;

export type GeneratedSiteBundle = {
  html: string;
  css: string;
  desktopMinHeight: number;
  phoneMinHeight: number;
};

export function validateGeneratedSiteSource(input: { html: string; css: string; approvedAssetSources: readonly string[] }): string[] {
  const issues: string[] = [];
  if (!input.html.trim()) issues.push("document.html must not be empty");
  if (input.html.length > 180_000) issues.push("document.html exceeds 180000 characters");
  if (input.css.length > 180_000) issues.push("document.css exceeds 180000 characters");
  if (FORBIDDEN_SOURCE.test(input.html)) issues.push("document.html contains active or forbidden markup");
  if (/<\/?(?:html|head|body)\b/i.test(input.html)) issues.push("document.html must be a body fragment, not a second document shell");
  if (/[<>\\]/.test(input.css) || /\/\*|@import|@font-face|expression\s*\(|-moz-binding|(?:^|[;{])\s*behavior\s*:/i.test(input.css)) issues.push("document.css contains forbidden syntax");
  const assets = new Set(input.approvedAssetSources);
  for (const match of input.css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) if (!assets.has(match[2])) issues.push(`document.css references an unapproved asset: ${match[2]}`);
  try { validateMarkup(input.html, assets); } catch (error) { issues.push(error instanceof Error ? error.message : "document.html is invalid"); }
  if (!/<h1(?:\s|>)/i.test(input.html)) issues.push("document.html requires one visible h1");
  if ((input.html.match(/<h1(?:\s|>)/gi) ?? []).length !== 1) issues.push("document.html requires exactly one h1");
  if (!/@media\s*\(/i.test(input.css)) issues.push("document.css requires responsive media rules");
  if (!/@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/i.test(input.css)) issues.push("document.css requires a prefers-reduced-motion fallback");
  return [...new Set(issues)].slice(0, 40);
}

function validateMarkup(source: string, assets: ReadonlySet<string>) {
  const stack: string[] = [];
  let cursor = 0;
  const tags = /<[^>]*>/g;
  for (let match = tags.exec(source); match; match = tags.exec(source)) {
    if (source.slice(cursor, match.index).includes("<") || source.slice(cursor, match.index).includes(">")) throw new Error("document.html contains malformed markup");
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)\s*([^>]*)>$/i.exec(match[0]);
    if (!parsed) throw new Error("document.html contains malformed markup");
    const closing = parsed[1] === "/";
    const tag = parsed[2].toLowerCase();
    if (!SAFE_TAGS.has(tag)) throw new Error(`document.html tag is not allowed: ${tag}`);
    if (closing) {
      if (parsed[3].trim() || VOID_TAGS.has(tag) || stack.pop() !== tag) throw new Error(`document.html has an unbalanced ${tag} tag`);
    } else {
      const selfClosing = /\/\s*$/.test(parsed[3]);
      validateAttributes(tag, parsed[3].replace(/\/\s*$/, ""), assets);
      if (selfClosing && !VOID_TAGS.has(tag)) throw new Error(`document.html cannot self-close ${tag}`);
      if (!VOID_TAGS.has(tag)) stack.push(tag);
    }
    cursor = match.index + match[0].length;
  }
  if (source.slice(cursor).includes("<") || source.slice(cursor).includes(">") || stack.length) throw new Error("document.html contains unbalanced markup");
}

function validateAttributes(tag: string, source: string, assets: ReadonlySet<string>) {
  const allowed = /^(?:class|id|title|role|aria-[a-z-]+|data-buildmates-repeat|href|target|rel|src|alt|width|height|loading|decoding)$/;
  let cursor = 0;
  const expression = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/giy;
  const values = new Map<string, string>();
  while (cursor < source.length) {
    cursor += /^\s*/.exec(source.slice(cursor))?.[0].length ?? 0;
    if (cursor >= source.length) break;
    expression.lastIndex = cursor;
    const match = expression.exec(source);
    if (!match) throw new Error("document.html contains an invalid attribute");
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? "";
    if (!allowed.test(name)) throw new Error(`document.html attribute is not allowed: ${name}`);
    if (values.has(name)) throw new Error(`document.html repeats an attribute: ${name}`);
    values.set(name, value);
    if (name === "src" && (tag !== "img" || !assets.has(value) || !ASSET_PATH.test(value))) throw new Error("document.html image source is not an approved asset");
    if (name === "href" && !/^https:\/\/[a-z0-9.-]+(?:[/:?#]|$)/i.test(value) && !/^\{\{\s*item\.href\s*\}\}$/.test(value)) throw new Error("document.html link must use HTTPS or an approved project binding");
    if (name === "target" && value !== "_blank") throw new Error("document.html links may open only in a new tab");
    if (name === "data-buildmates-repeat" && !/^[a-z][a-z0-9_.-]{0,95}$/i.test(value)) throw new Error("document.html has an invalid repeat binding");
    cursor = expression.lastIndex;
  }
  if (tag === "a" && (values.get("target") !== "_blank" || !/^noopener noreferrer$|^noreferrer noopener$/.test(values.get("rel") ?? ""))) throw new Error("document.html links require target _blank and rel noopener noreferrer");
}

export function renderGeneratedSite(input: { html: string; css: string; bindings: SurfaceBindings; approvedAssetSources: readonly string[] }): string {
  const issues = validateGeneratedSiteSource({ html: input.html, css: input.css, approvedAssetSources: input.approvedAssetSources });
  if (issues.length) throw new Error(issues[0]);
  let html = input.html.replace(/<template\s+data-buildmates-repeat=(?:"([^"]+)"|'([^']+)')\s*>([\s\S]*?)<\/template>/gi, (_all, doubleKey, singleKey, template) => {
    const key = doubleKey ?? singleKey;
    const value = input.bindings[key];
    const items = repeatItems(value);
    return items.map((item) => replaceTokens(template, input.bindings, item)).join("");
  });
  html = replaceTokens(html, input.bindings, null);
  const assetOrigins = input.approvedAssetSources.length ? " 'self'" : "";
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src${assetOrigins}; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; script-src 'none'">`,
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"referrer\" content=\"no-referrer\">",
    "<style>html,body{margin:0;min-height:100%;background:transparent}*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}a:focus-visible{outline:3px solid currentColor;outline-offset:4px}",
    input.css,
    "</style></head><body>", html, "</body></html>",
  ].join("");
}

function repeatItems(value: SurfaceBinding | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => typeof item === "string" ? [{ value: item }] : item && typeof item === "object" ? [item as unknown as Record<string, unknown>] : []);
}

function replaceTokens(source: string, bindings: SurfaceBindings, item: Record<string, unknown> | null) {
  return source.replace(BINDING_TOKEN, (_all, key: string) => {
    const value = key.startsWith("item.") ? item?.[key.slice(5)] : bindings[key];
    if (key === "item.href") return typeof value === "string" && /^https:\/\//i.test(value) ? escapeAttribute(value) : "#";
    if (Array.isArray(value)) return escapeHtml(value.map(displayValue).filter(Boolean).join(", "));
    return escapeHtml(displayValue(value));
  });
}

function displayValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (isFact(value)) return `${value.label}: ${value.value}`;
  if (isProject(value)) return value.title;
  return "";
}
function isFact(value: unknown): value is SurfaceFact { return Boolean(value && typeof value === "object" && typeof (value as SurfaceFact).label === "string" && typeof (value as SurfaceFact).value === "string"); }
function isProject(value: unknown): value is SurfaceProject { return Boolean(value && typeof value === "object" && typeof (value as { title?: unknown }).title === "string"); }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function escapeAttribute(value: string) { return escapeHtml(value); }
