const SAFE_PROPERTIES = new Set([
  "align-items", "background", "background-color", "border", "border-color", "border-radius", "border-style", "border-width",
  "color", "column-gap", "display", "flex", "flex-basis", "flex-direction", "flex-grow", "flex-shrink", "flex-wrap",
  "font-family", "font-size", "font-style", "font-weight", "gap", "grid-column", "grid-row", "grid-template-columns",
  "height", "justify-content", "letter-spacing", "line-height", "margin", "margin-block", "margin-inline", "margin-top", "margin-right", "margin-bottom", "margin-left", "max-height",
  "max-width", "min-height", "min-width", "opacity", "overflow", "overflow-wrap", "padding", "padding-block", "padding-inline", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "text-align", "text-decoration", "text-transform", "transform", "transition", "white-space", "width", "word-break",
]);
const SAFE_SELECTOR = /^\.[a-z][a-z0-9_-]*(?:(?:\s+|\s*>\s*)(?:\.[a-z][a-z0-9_-]*|article|aside|blockquote|div|figcaption|figure|h2|h3|h4|li|ol|p|section|span|strong|ul))*(?::(?:first-child|last-child|nth-child\([0-9n+ -]+\)))?$/i;
const FORBIDDEN = /(?:[<>&]|\/\*|@import|@font-face|url\s*\(|(?:^|[^-])image\s*\(|(?:-webkit-)?image-set\s*\(|cross-fade\s*\(|element\s*\(|expression\s*\(|(?:https?|ftp|file|javascript|data|blob|vbscript)\s*:|@namespace|-moz-binding|behavior\s*:|\\|[\u0000-\u0008\u000b\u000c\u000e-\u001f])/i;

/**
 * Parses a deliberately small CSS grammar instead of trying to clean arbitrary
 * CSS. Generated decoration gets class-led rules and bounded width queries;
 * everything else is rejected before it can become iframe srcdoc.
 */
export function scopeDecorativeCss(css: string, regionId: string): string {
  if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(regionId)) throw new Error("invalid_region_id");
  if (FORBIDDEN.test(css)) throw new Error("unsafe_css_value");
  return parseRules(css.trim(), `[data-surface-region="${regionId}"]`);
}

function parseRules(source: string, prefix: string): string {
  let cursor = 0;
  const output: string[] = [];
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? "")) cursor++;
    if (cursor >= source.length) break;
    if (source.startsWith("@media", cursor)) {
      const open = source.indexOf("{", cursor);
      if (open < 0) throw new Error("unsafe_media_query");
      const query = source.slice(cursor + 6, open).trim();
      if (!/^\((?:max|min)-width:\s*(?:[2-9]\d{2}|1\d{3})px\)$/i.test(query)) throw new Error("unsafe_media_query");
      const close = matchingBrace(source, open);
      output.push(`@media ${query}{${parseRules(source.slice(open + 1, close), prefix)}}`);
      cursor = close + 1;
      continue;
    }
    if (source[cursor] === "@") throw new Error("unsafe_css_at_rule");
    const open = source.indexOf("{", cursor);
    if (open < 0) throw new Error("unsafe_css_rule");
    const close = matchingBrace(source, open);
    const selectorText = source.slice(cursor, open).trim();
    const selectors = selectorText.split(",").map((selector) => selector.trim());
    if (!selectors.length || selectors.some((selector) => !SAFE_SELECTOR.test(selector))) throw new Error("unsafe_global_selector");
    const declarations = parseDeclarations(source.slice(open + 1, close));
    output.push(`${selectors.map((selector) => `${prefix} ${selector}`).join(",")}{${declarations}}`);
    cursor = close + 1;
  }
  return output.join("");
}

function parseDeclarations(source: string): string {
  if (/[{}@]/.test(source)) throw new Error("unsafe_css_declaration");
  return source.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf(":");
    if (separator <= 0) throw new Error("unsafe_css_declaration");
    const property = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (!SAFE_PROPERTIES.has(property)) throw new Error(`unsafe_css_property:${property}`);
    if (!value || FORBIDDEN.test(value) || /(?:fixed|sticky)/i.test(value)) throw new Error("unsafe_css_value");
    return `${property}:${value}`;
  }).join(";");
}

function matchingBrace(source: string, open: number): number {
  let depth = 0;
  let quote = "";
  for (let index = open; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === "{") depth++;
    if (character === "}" && --depth === 0) return index;
  }
  throw new Error("unsafe_css_unbalanced");
}
