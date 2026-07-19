import { describe, expect, it } from "vitest";
import { z } from "zod";
import { designPolicy, EDITORIAL_RESEARCH_PROFILE, safeParseSurfaceSpec, surfaceNodeSchema, type SurfaceNodeV2 } from "@buildmates/surfaces";
import { customizedProfileSurfaceExample, surfaceComponentReference } from "../../packages/mcp-core/src/surface-generation-reference";

type JsonSchema = Record<string, unknown>;

describe("Surface generation reference", () => {
  it("stays compact and matches every trusted component's schema", () => {
    const reference = surfaceComponentReference(designPolicy.trustedComponents);
    const schema = z.toJSONSchema(surfaceNodeSchema) as JsonSchema;
    const variants = Object.fromEntries((schema.oneOf as JsonSchema[]).map((variant) => {
      const properties = variant.properties as Record<string, JsonSchema>;
      return [properties.type.const as string, variant];
    }));
    expect(Object.keys(reference.components).sort()).toEqual([...designPolicy.trustedComponents].sort());
    expect(Buffer.byteLength(JSON.stringify(reference), "utf8")).toBeLessThan(16_000);
    for (const [type, component] of Object.entries(reference.components)) {
      const variant = variants[type];
      expect(component.required).toEqual(variant.required);
      expect(Object.keys(component.properties).sort()).toEqual(Object.keys(variant.properties as object).sort());
      for (const [property, compact] of Object.entries(component.properties)) {
        if (!Array.isArray(compact)) continue;
        const source = (variant.properties as Record<string, JsonSchema>)[property];
        const exact = "const" in source ? [source.const] : Array.isArray(source.enum) ? source.enum : Array.isArray(source.anyOf) ? (source.anyOf as JsonSchema[]).map((item) => item.type === "null" ? null : item.const) : undefined;
        expect(compact).toEqual(exact);
      }
    }
  });

  it("provides a representative customized profile that validates on the first attempt", () => {
    const spec = customizedProfileSurfaceExample({
      starterSpec: EDITORIAL_RESEARCH_PROFILE,
      authorizedBindingTypes: {
        "profile.displayName": "text", "profile.summary": "text",
        "profile.facts": "facts", "profile.projects": "projects",
      },
      authorizedContent: { "profile.projects": [{ id: "one" }, { id: "two" }, { id: "three" }] },
      trustedComponents: designPolicy.trustedComponents,
    });
    expect(spec).not.toBeNull();
    expect(safeParseSurfaceSpec(spec, designPolicy.version, { forRevisionCreation: true }).success).toBe(true);
    const types = collectTypes(spec!.root);
    expect(types).toEqual(expect.arrayContaining(["split", "frame", "project-list", "project-artifact", "fact-list"]));
    expect(types.filter((type) => type === "section").length).toBeGreaterThanOrEqual(3);
    expect(types.length).toBeGreaterThanOrEqual(16);
    expect(collectProjectIndexes(spec!.root, "featured-project")).toEqual([0, 1, 2]);
    expect(collectProjectIndexes(spec!.root, "project-artifact")).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(spec!.title).toBe("Customized builder profile");
  });
});

function collectTypes(root: SurfaceNodeV2): string[] {
  return [root.type, ...("children" in root ? root.children.flatMap(collectTypes) : [])];
}

function collectProjectIndexes(root: SurfaceNodeV2, type: "featured-project" | "project-artifact"): number[] {
  const own = root.type === type ? [root.index] : [];
  return [...own, ...("children" in root ? root.children.flatMap((child) => collectProjectIndexes(child, type)) : [])].sort((a, b) => a - b);
}
