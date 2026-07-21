import { describe, expect, it } from "vitest";
import { designPolicy, safeParseSurfaceSpec } from "@buildmates/surfaces";
import { customizedProfileSurfaceExample, surfaceComponentReference } from "../../packages/mcp-core/src/surface-generation-reference";

describe("Generated profile reference", () => {
  it("describes full HTML and CSS instead of a component catalogue", () => {
    const reference = surfaceComponentReference([]);
    expect(reference.format).toBe("GeneratedSiteBundle v3");
    expect(reference.css.arbitrarySelectorsAndLayout).toBe(true);
    expect(reference.contract.join(" ")).toContain("Do not compose Buildmates components");
    expect(reference.contract.join(" ")).toContain("Do not size page sections with vh, svh, lvh, or dvh");
    expect(reference.contract.join(" ")).toContain("representative QA checkpoints and initial loading estimates, not fixed canvases");
    expect(Buffer.byteLength(JSON.stringify(reference), "utf8")).toBeLessThan(16_000);
  });

  it("provides a valid syntax-recovery bundle without prescribing an architecture", () => {
    const spec = customizedProfileSurfaceExample({
      authorizedBindingTypes: {
        "profile.displayName": "text", "profile.summary": "text",
        "profile.facts": "facts", "profile.projects": "projects",
      },
    });
    expect(spec).not.toBeNull();
    expect(safeParseSurfaceSpec(spec, designPolicy.version, { forRevisionCreation: true }).success).toBe(true);
    expect(spec!.schemaVersion).toBe("3");
    expect(spec!.document.html).toContain("data-buildmates-repeat=\"profile.projects\"");
    expect(spec!.document.css).toContain("prefers-reduced-motion");
    expect(spec).not.toHaveProperty("root");
  });
});
