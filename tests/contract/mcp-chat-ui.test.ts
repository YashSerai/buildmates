import { describe, expect, it } from "vitest";
import {
  BUILD_MATES_CHAT_UI_HTML,
  BUILD_MATES_UI_ACTION_TOOLS,
  BUILD_MATES_UI_MIME_TYPE,
  BUILD_MATES_UI_RESOURCE_URI,
  buildmatesChatUiResource,
  buildmatesChatUiToolMeta,
} from "@buildmates/mcp-core";

describe("Buildmates MCP Apps workspace UI", () => {
  it("returns a versioned MCP Apps resource with a tight CSP", () => {
    const resource = buildmatesChatUiResource();

    expect(resource.uri).toBe(BUILD_MATES_UI_RESOURCE_URI);
    expect(resource.mimeType).toBe(BUILD_MATES_UI_MIME_TYPE);
    expect(resource.text).toContain("ui/initialize");
    expect(resource.text).toContain("ui/notifications/tool-result");
    expect(resource._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [] });
    expect(resource._meta["openai/ui"]).toEqual({ availableDisplayModes: ["inline"] });
  });

  it("uses the portable resource metadata and ChatGPT compatibility alias", () => {
    expect(buildmatesChatUiToolMeta()).toEqual({
      ui: { resourceUri: BUILD_MATES_UI_RESOURCE_URI },
      "openai/outputTemplate": BUILD_MATES_UI_RESOURCE_URI,
    });
  });

  it("keeps the iframe self-contained and treats host messages as untrusted", () => {
    expect(BUILD_MATES_CHAT_UI_HTML).not.toMatch(/<script[^>]+src=/i);
    expect(BUILD_MATES_CHAT_UI_HTML).not.toContain("localStorage");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("event.source !== window.parent");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("state.hostOrigin");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("textContent");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("ACTION_TOOLS");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("setAttribute('sandbox', '')");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("snapshotFromResult");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain('viewBox="0 0 72 56"');
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("Refresh workspace");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("Check the workspace before trying again.");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("The action may have saved. Check the workspace before trying again.");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("delete button.dataset.idempotencyKey");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("Buildmates returned an invalid workspace snapshot.");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("confirmation: 'confirmed'");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("function activeRecord(value)");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("Messaging is unavailable");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("function knownCount(value, collections)");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("text(room.otherName, 'Room member')");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain(".nav::after");
  });

  it("renders the core workspace surfaces and keeps a headless tool fallback", () => {
    for (const view of ["Overview", "Profile", "Introductions", "Connections", "Circles", "Activity", "Privacy"]) {
      expect(BUILD_MATES_CHAT_UI_HTML).toContain(view);
    }
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("get_buildmates_workspace");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("tools/call");
    expect(BUILD_MATES_CHAT_UI_HTML).toContain("structuredContent");
    expect(BUILD_MATES_UI_ACTION_TOOLS).toEqual([
      "perform_buildmates_action",
      "perform_buildmates_project_action",
      "perform_buildmates_relationship_action",
      "perform_buildmates_circle_action",
    ]);
    for (const tool of BUILD_MATES_UI_ACTION_TOOLS) expect(BUILD_MATES_CHAT_UI_HTML).toContain(tool);
  });
});
