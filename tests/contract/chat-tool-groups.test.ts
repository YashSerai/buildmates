import { z } from "zod";
import { describe, expect, it } from "vitest";
import { chatActionSchema, type ChatAction } from "@buildmates/mcp-core";
import { buildmatesChatActionToolName, buildmatesChatToolGroups } from "@buildmates/mcp-core";

const MAX_TOOL_SCHEMA_BYTES = 16_000;
type JsonSchema = { properties?: Record<string, { const?: unknown }> };

function actionKinds(): ChatAction["kind"][] {
  return chatActionSchema.options.map((option) => {
    const kind = (z.toJSONSchema(option) as JsonSchema).properties?.kind?.const;
    if (typeof kind !== "string") throw new Error("chat_action_kind_missing");
    return kind as ChatAction["kind"];
  });
}

describe("scoped ChatGPT action tool groups", () => {
  it("covers every authoritative action exactly once", () => {
    const authoritative = actionKinds();
    const grouped = buildmatesChatToolGroups.flatMap((group) => group.kinds);

    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...authoritative].sort());
    for (const kind of authoritative) expect(buildmatesChatActionToolName(kind)).toBe(buildmatesChatToolGroups.find((group) => group.kinds.includes(kind))?.name);
  });

  it("keeps each strict schema below the host budget", () => {
    expect(buildmatesChatToolGroups).toHaveLength(4);
    for (const group of buildmatesChatToolGroups) {
      const bytes = Buffer.byteLength(JSON.stringify(z.toJSONSchema(group.schema)), "utf8");
      expect(bytes, `${group.name} schema bytes`).toBeLessThanOrEqual(MAX_TOOL_SCHEMA_BYTES);
      expect(group.name).toMatch(/^perform_buildmates(?:_[a-z]+)?_action$/);
      expect(group.title).toBeTruthy();
      expect(group.description).toBeTruthy();
    }
  });

  it("keeps action validation specific to its group and preserves branch refinements", () => {
    const core = buildmatesChatToolGroups.find((group) => group.name === "perform_buildmates_action")!;
    const projects = buildmatesChatToolGroups.find((group) => group.name === "perform_buildmates_project_action")!;
    const relationship = buildmatesChatToolGroups.find((group) => group.name === "perform_buildmates_relationship_action")!;
    const circles = buildmatesChatToolGroups.find((group) => group.name === "perform_buildmates_circle_action")!;
    const wrapper = { idempotencyKey: "group-test-1", workspaceScope: "global" };

    expect(core.schema.safeParse({ ...wrapper, action: { kind: "resume_matching" } }).success).toBe(true);
    expect(core.schema.safeParse({ ...wrapper, action: { kind: "archive_project", slug: "project-one" } }).success).toBe(false);
    expect(core.schema.safeParse({ ...wrapper, action: { kind: "resume_matching", extra: true } }).success).toBe(false);
    expect(projects.schema.safeParse({ ...wrapper, action: { kind: "archive_project", slug: "project-one" } }).success).toBe(true);
    expect(relationship.schema.safeParse({ ...wrapper, action: { kind: "mark_room_read", roomId: "room-one", messageId: null } }).success).toBe(true);
    expect(circles.schema.safeParse({ ...wrapper, action: { kind: "leave_circle", circleId: "circle-one", confirmation: "confirmed" } }).success).toBe(true);

    const project = { slug: "project-one", title: "Project one", summary: "A reviewed project", audience: "public", allowMatching: true, stage: "building", status: "active", links: [], taxonomy: [] } as const;
    expect(projects.schema.safeParse({ ...wrapper, action: { kind: "save_project", project } }).success).toBe(false);
    expect(projects.schema.safeParse({ ...wrapper, action: { kind: "save_project", project, confirmation: "confirmed" } }).success).toBe(true);
  });
});
