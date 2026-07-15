import { scopeDecorativeCss } from "./scope-css";

const ALLOWED_TAGS = ["article", "aside", "blockquote", "br", "div", "em", "figcaption", "figure", "h2", "h3", "h4", "li", "ol", "p", "section", "span", "strong", "ul"];
const ACTIVE_CONTENT = /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math|video|audio|canvas)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:|vbscript\s*:/i;

export type SanitizedDecorativeRegion = { id: string; label: string; html: string; css: string; srcDoc: string };

export function sanitizeDecorativeRegion(input: { id: string; label: string; html: string; css: string }): SanitizedDecorativeRegion {
  if (ACTIVE_CONTENT.test(input.html)) throw new Error("unsafe_decorative_html");
  const html = parseDecorativeHtml(input.html);
  const css = scopeDecorativeCss(input.css, input.id);
  // Defense at the srcdoc construction boundary: CSS must be incapable of
  // closing the style element directly or through an HTML entity.
  if (/[<>&]/.test(css)) throw new Error("unsafe_css_srcdoc");
  const srcDoc = [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; style-src 'unsafe-inline'\">",
    "<meta name=\"referrer\" content=\"no-referrer\"><style>",
    "html,body{margin:0;min-height:100%;background:transparent;color:inherit;font:inherit}*{box-sizing:border-box}",
    css,
    `</style></head><body><div data-surface-region=\"${input.id}\">`,
    html,
    "</div></body></html>",
  ].join("");
  return { ...input, html, css, srcDoc };
}

function parseDecorativeHtml(source: string): string {
  const allowed = new Set(ALLOWED_TAGS);
  const voidTags = new Set(["br"]);
  const stack: string[] = [];
  const output: string[] = [];
  let cursor = 0;
  const tags = /<[^>]*>/g;
  for (let match = tags.exec(source); match; match = tags.exec(source)) {
    output.push(escapeText(source.slice(cursor, match.index)));
    const token = match[0];
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\s*([^>]*)>$/i.exec(token);
    if (!parsed) throw new Error("unsafe_decorative_html");
    const closing = parsed[1] === "/";
    const tag = parsed[2].toLowerCase();
    if (!allowed.has(tag)) throw new Error("unsafe_decorative_html");
    if (closing) {
      if (parsed[3].trim() || stack.pop() !== tag || voidTags.has(tag)) throw new Error("unsafe_decorative_html");
      output.push(`</${tag}>`);
    } else {
      const selfClosing = /\/\s*$/.test(parsed[3]);
      const attributes = parseAttributes(parsed[3].replace(/\/\s*$/, ""));
      if (selfClosing && !voidTags.has(tag)) throw new Error("unsafe_decorative_html");
      output.push(`<${tag}${attributes}>`);
      if (!voidTags.has(tag)) stack.push(tag);
    }
    cursor = match.index + token.length;
  }
  if (source.slice(cursor).includes("<") || source.slice(cursor).includes(">")) throw new Error("unsafe_decorative_html");
  output.push(escapeText(source.slice(cursor)));
  if (stack.length) throw new Error("unsafe_decorative_html");
  return output.join("");
}

function parseAttributes(source: string): string {
  let cursor = 0;
  const output: string[] = [];
  const expression = /([a-z][a-z-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/giy;
  while (cursor < source.length) {
    const whitespace = /^\s*/.exec(source.slice(cursor))?.[0] ?? "";
    if (cursor > 0 && whitespace.length === 0) throw new Error("unsafe_decorative_html");
    cursor += whitespace.length;
    if (cursor >= source.length) break;
    expression.lastIndex = cursor;
    const match = expression.exec(source);
    if (!match) {
      if (source.slice(cursor).trim()) throw new Error("unsafe_decorative_html");
      break;
    }
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? "";
    if (name === "class") {
      if (!value.split(/\s+/).every((item) => /^[a-z][a-z0-9_-]{0,47}$/i.test(item))) throw new Error("unsafe_decorative_html");
    } else if (name === "aria-label") {
      if (!value || value.length > 160) throw new Error("unsafe_decorative_html");
    } else if (name === "aria-hidden") {
      if (!/^(?:true|false)$/.test(value)) throw new Error("unsafe_decorative_html");
    } else if (name === "role") {
      if (!/^(?:img|note|presentation|group)$/.test(value)) throw new Error("unsafe_decorative_html");
    } else throw new Error("unsafe_decorative_html");
    output.push(` ${name}="${escapeAttribute(value)}"`);
    cursor = expression.lastIndex;
  }
  return output.join("");
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

export const APPROVED_ASSET_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const CONTENT_TYPE_EXTENSION: Record<string, readonly string[]> = {
  "image/avif": ["avif"], "image/gif": ["gif"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"],
};

export function validateSurfaceAsset(input: { objectKey: string; contentType: string; byteSize: number }): void {
  const contentType = input.contentType.toLowerCase();
  if (!APPROVED_ASSET_TYPES.has(contentType)) throw new Error("surface_asset_type_forbidden");
  if (!/^surface-assets\/[a-z0-9_-]+\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(input.objectKey)) throw new Error("surface_asset_key_invalid");
  const extension = input.objectKey.split(".").pop()?.toLowerCase() ?? "";
  if (!CONTENT_TYPE_EXTENSION[contentType]?.includes(extension)) throw new Error("surface_asset_extension_mismatch");
  const limit = 12_000_000;
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > limit) throw new Error("surface_asset_size_invalid");
}

export function surfaceAssetResponseHeaders(contentType: string): Readonly<Record<string, string>> {
  if (!APPROVED_ASSET_TYPES.has(contentType.toLowerCase())) throw new Error("surface_asset_type_forbidden");
  return {
    "Content-Type": contentType.toLowerCase(),
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-site",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, no-store",
    "Vary": "oai-authenticated-user-id, Authorization",
  };
}
