import { describe, expect, it } from "vitest";
import { sanitizeDecorativeRegion, scopeDecorativeCss, surfaceAssetResponseHeaders, validateSurfaceAsset } from "@buildmates/surfaces";

describe("decorative surface isolation", () => {
  it("sanitizes allowed editorial markup and scopes every selector", () => {
    const output = sanitizeDecorativeRegion({ id: "note", label: "Note", html: '<section class="note"><h2>Field note</h2><p>Safe text</p></section>', css: ".note,.note p{color:#24251f;padding:1rem}" });
    expect(output.html).toContain("Field note");
    expect(output.css).toContain('[data-surface-region="note"] .note');
    expect(output.srcDoc).toContain("default-src 'none'");
    expect(output.srcDoc).toContain("form-action 'none'");
    expect(output.srcDoc).not.toContain("allow-scripts");
  });
  it.each([
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<form action="https://attacker.test"><input></form>',
    '<svg><a href="javascript:alert(1)">x</a></svg>', '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  ])("rejects active or XSS markup: %s", (html) => {
    expect(() => sanitizeDecorativeRegion({ id: "note", label: "Note", html, css: ".note{color:#222}" })).toThrow(/unsafe/);
  });
  it.each([
    "@import 'https://attacker.test/x.css';", ".x{background:url(https://attacker.test/x)}", "body{color:red}", "*{color:red}",
    ".x{position:fixed}", ".x{position:sticky}", ".x{z-index:999999}", "@font-face{font-family:x;src:url(x)}", ".x:has(.secret){color:red}",
    ".x{background:image(https://attacker.test/pixel)}", ".x{background:image-set('https://attacker.test/a.png' 1x)}",
    ".x{background:-webkit-image-set('https://attacker.test/a.png' 1x)}", ".x{background:u\\72l(https://attacker.test/x)}",
    ".x{background:im\\61ge(https://attacker.test/x)}", ".x{color:var(--x,https://attacker.test)}",
    ".x{color:red}</style><img src=x onerror=alert(1)><style>", ".x{color:red}</StYlE ><script>alert(1)</script><style>",
    ".x{color:red}&lt;/style&gt;&lt;img src=x&gt;", ".x{color:red}\\3c /style\\3e ",
  ])("rejects escaping, networking, or overlay CSS: %s", (css) => expect(() => scopeDecorativeCss(css, "note")).toThrow(/unsafe/));
  it("cannot place rejected CSS outside the srcdoc style element", () => {
    expect(() => sanitizeDecorativeRegion({ id: "note", label: "Note", html: "<p>Safe</p>", css: ".x{color:red}</style><img src=x onerror=alert(1)>" })).toThrow(/unsafe/);
  });
  it("allows only bounded media queries", () => expect(scopeDecorativeCss("@media (max-width: 720px){.note{display:block}}", "note")).toContain("@media"));
});

describe("surface asset policy", () => {
  const hash = "a".repeat(64);
  it("accepts passive R2 object types and emits non-sniffable headers", () => {
    expect(() => validateSurfaceAsset({ objectKey: `surface-assets/user_1/${hash}.webp`, contentType: "image/webp", byteSize: 1024 })).not.toThrow();
    expect(surfaceAssetResponseHeaders("image/webp")).toMatchObject({ "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" });
  });
  it.each(["text/html", "image/svg+xml", "application/javascript"])("forbids executable type %s", (contentType) => expect(() => validateSurfaceAsset({ objectKey: `surface-assets/user_1/${hash}.svg`, contentType, byteSize: 100 })).toThrow(/forbidden/));
  it.each(["font/woff", "font/woff2"])("does not advertise unusable font upload type %s", (contentType) => expect(() => validateSurfaceAsset({ objectKey: `surface-assets/user_1/${hash}.woff`, contentType, byteSize: 100 })).toThrow(/forbidden/));
  it("rejects extension confusion and oversized assets", () => {
    expect(() => validateSurfaceAsset({ objectKey: `surface-assets/user_1/${hash}.html`, contentType: "image/png", byteSize: 100 })).toThrow(/mismatch/);
    expect(() => validateSurfaceAsset({ objectKey: `surface-assets/user_1/${hash}.png`, contentType: "image/png", byteSize: 99_000_000 })).toThrow(/size/);
  });
});
