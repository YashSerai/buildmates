import { describe, expect, it } from "vitest";
import { EDITORIAL_RESEARCH_PROFILE, type SurfaceNodeV2 } from "@buildmates/surfaces";
import { targetedSurfaceRevisionIsAllowed } from "../../packages/mcp-core/src/surface-revision-intent";

describe("targeted SurfaceSpec revisions", () => {
  it("allows one named node to change while preserving the rest of the page", () => {
    const base = structuredClone(EDITORIAL_RESEARCH_PROFILE);
    const candidate = structuredClone(base);
    const heading = findHeading(candidate.root);
    heading.size = "display";
    expect(targetedSurfaceRevisionIsAllowed(base, candidate, {
      mode: "targeted", summary: "Reduce the title", targetNodeIds: [heading.id], targetThemeKeys: [],
    })).toBe(true);
  });

  it("rejects collateral changes outside the named target", () => {
    const base = structuredClone(EDITORIAL_RESEARCH_PROFILE);
    const candidate = structuredClone(base);
    const heading = findHeading(candidate.root);
    heading.size = "display";
    candidate.title = "A different page";
    expect(targetedSurfaceRevisionIsAllowed(base, candidate, {
      mode: "targeted", summary: "Reduce the title", targetNodeIds: [heading.id], targetThemeKeys: [],
    })).toBe(false);
  });
});

function findHeading(node: SurfaceNodeV2): Extract<SurfaceNodeV2, { type: "heading" }> {
  const result = find(node);
  if (!result) throw new Error("fixture_heading_missing");
  return result;
}

function find(node: SurfaceNodeV2): Extract<SurfaceNodeV2, { type: "heading" }> | null {
  if (node.type === "heading") return node;
  if ("children" in node) for (const child of node.children) {
    const result = find(child);
    if (result) return result;
  }
  return null;
}
