import { describe, expect, it } from "vitest";
import { DESIGN_POLICY_VERSION, renderGeneratedSite, safeParseSurfaceSpec } from "@buildmates/surfaces";

const base = {
  schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "Safe profile",
  document: {
    html: '<main><h1>{{profile.displayName}}</h1><template data-buildmates-repeat="profile.projects"><article><h2>{{item.title}}</h2><p>{{item.summary}}</p></article></template></main>',
    css: 'main{padding:4rem}@media(max-width:600px){main{padding:1rem}}@media (prefers-reduced-motion: reduce){*{animation:none!important}}',
  },
  bindingManifest: { content: [{ key: "profile.displayName", type: "text" }, { key: "profile.projects", type: "projects" }], media: [] },
  approvedAssets: [], responsive: { desktopMinHeight: 900, phoneMinHeight: 1100 }, accessibility: { label: "Builder profile", reducedMotion: "required" },
} as const;

describe("GeneratedSiteBundle v3 security", () => {
  it.each(["room", "circle"] as const)("accepts safe %s HTML/CSS without widening active authority", (kind) => {
    const key = kind === "room" ? "room.title" : "circle.name";
    const parsed = safeParseSurfaceSpec({
      ...base,
      kind,
      title: `Safe ${kind}`,
      document: { ...base.document, html: `<main><h1>{{${key}}}</h1></main>` },
      bindingManifest: { content: [{ key, type: "text" }], media: [] },
    }, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
    expect(parsed.success).toBe(true);
  });
  it("renders current bindings inside a scriptless CSP document", () => {
    const parsed = safeParseSurfaceSpec(base, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
    expect(parsed.success).toBe(true);
    const srcDoc = renderGeneratedSite({ html: base.document.html, css: base.document.css, approvedAssetSources: [], bindings: { "profile.displayName": "Yash <script>", "profile.projects": [{ id: "one", title: "Buildmates", summary: "Builder network" }] } });
    expect(srcDoc).toContain("Yash &lt;script&gt;");
    expect(srcDoc).toContain("Buildmates");
    expect(srcDoc).toContain("script-src 'none'");
    expect(srcDoc).not.toContain("<script>");
  });

  it.each([
    ["script", '<main><h1>{{profile.displayName}}</h1><script>alert(1)</script></main>', base.document.css],
    ["handler", '<main onload="alert(1)"><h1>{{profile.displayName}}</h1></main>', base.document.css],
    ["form", '<main><h1>{{profile.displayName}}</h1><form></form></main>', base.document.css],
    ["network", base.document.html, 'main{background:url(https://evil.example/x)}@media(max-width:600px){main{padding:1rem}}@media (prefers-reduced-motion: reduce){*{animation:none}}'],
    ["import", base.document.html, '@import url(https://evil.example/x);@media(max-width:600px){main{padding:1rem}}@media (prefers-reduced-motion: reduce){*{animation:none}}'],
    ["escaped CSS", base.document.html, 'main{background:u\\72l(https://evil.example/x)}@media(max-width:600px){main{padding:1rem}}@media (prefers-reduced-motion: reduce){*{animation:none}}'],
    ["comment-obfuscated CSS", base.document.html, 'main{background:u/**/rl(https://evil.example/x)}@media(max-width:600px){main{padding:1rem}}@media (prefers-reduced-motion: reduce){*{animation:none}}'],
    ["undeclared binding", '<main><h1>{{profile.displayName}}</h1><p>{{profile.privateNotes}}</p><template data-buildmates-repeat="profile.projects"><article><h2>{{item.title}}</h2></article></template></main>', base.document.css],
  ])("rejects %s authority", (_name, html, css) => {
    expect(safeParseSurfaceSpec({ ...base, document: { html, css } }, DESIGN_POLICY_VERSION, { forRevisionCreation: true }).success).toBe(false);
  });
});
