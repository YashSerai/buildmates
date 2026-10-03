import { expect, test } from "@playwright/test";
import { BUILD_MATES_CHAT_UI_HTML, buildmatesChatActionToolName, chatActionSchema, chatWorkspaceViewSchema } from "@buildmates/mcp-core";
import { signInTestUser } from "./helpers/auth";

type BridgeEvent = {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
};

test("website fallback hands setup to ChatGPT or Codex and preserves a manual route", async ({ page }, testInfo) => {
  await signInTestUser(page, `chat-plugin-fallback-${testInfo.project.name}-${Date.now()}`);
  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Build your profile with your AI host" })).toBeVisible();
  await expect(page.getByText("Connect Buildmates once")).toBeVisible();
  const handoff = page.getByRole("link", { name: "Continue in ChatGPT or Codex" });
  await expect(handoff).toHaveAttribute("href", "https://buildmates.yashns.chatgpt.site/install");
  await expect(page.getByLabel("Prompt to use in ChatGPT or Codex")).toHaveValue(/Read the current setup state/);

  await page.getByRole("link", { name: "Set up manually instead" }).click();
  await expect(page).toHaveTitle("Set up on the web | Buildmates");
  await expect(page.getByRole("heading", { name: "Continue setting up Buildmates" })).toBeVisible();
  await expect(page.getByText("Review the same profile, privacy choices, and networking preferences")).toBeVisible();
});

test("MCP Apps bridge renders canonical workspace DTOs and sends a scoped action group", async ({ page }, testInfo) => {
  const bridgeErrors: string[] = [];
  page.on("pageerror", (error) => bridgeErrors.push(`pageerror:${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") bridgeErrors.push(`console:${message.text()}`); });
  await signInTestUser(page, `chat-plugin-widget-${testInfo.project.name}-${Date.now()}`);
  const handle = `widget_${testInfo.project.name.replace(/[^a-z0-9]/gi, "").toLowerCase()}_${Date.now().toString(36).slice(-6)}`.slice(0, 32);
  const profile = {
    kind: "save_profile" as const,
    profile: {
      handle,
      displayName: "Widget Builder",
      summary: "I build practical tools for small software teams.",
      allowMatching: true,
      acceptanceMode: "manual" as const,
      fields: [],
    },
  };
  const profileResponse = await page.evaluate(async (input) => {
    const response = await fetch(`/api/profiles/${encodeURIComponent(input.profile.handle)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.profile),
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }, profile);
  expect(profileResponse.ok, profileResponse.body).toBe(true);
  const onboardingProbe = await page.evaluate(async () => {
    const response = await fetch("/api/onboarding", { cache: "no-store" });
    return { ok: response.ok, status: response.status, body: await response.text() };
  });
  expect(onboardingProbe.ok, onboardingProbe.body).toBe(true);
  const onboardingState = JSON.parse(onboardingProbe.body) as {
    generatedAt: string;
    profile: Record<string, unknown> | null;
    networking: Record<string, unknown> | null;
    holdings: { rooms: number; circles: number };
  };

  const actionTool = buildmatesChatActionToolName(profile.kind);
  const savedProfile = {
    ...profile,
    profile: {
      ...profile.profile,
      summary: "I build reliable tools for small software teams.",
    },
  };
  expect(actionTool).toBe("perform_buildmates_action");
  expect(chatActionSchema.safeParse(profile).success).toBe(true);
  expect(chatWorkspaceViewSchema.safeParse("home").success).toBe(true);
  expect(chatWorkspaceViewSchema.safeParse("profile").success).toBe(true);

  // An srcdoc iframe has an opaque origin. about:blank lets this local harness
  // exercise the widget's explicit null-origin test boundary without relaxing
  // the production ChatGPT/Codex allowlist.
  await page.goto("about:blank");
  await page.setContent('<iframe id="workspace" title="Buildmates workspace"></iframe>');
  await page.evaluate(({ html, actionTool, savedProfile, onboarding }) => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    if (!frame) throw new Error("workspace_frame_missing");
    const events: BridgeEvent[] = [];
    let currentOnboarding = onboarding;
    (window as Window & { __buildmatesEvents?: BridgeEvent[] }).__buildmatesEvents = events;
    async function workspace(view: string) {
      if (view === "profile") {
        return {
          view: "profile",
          data: currentOnboarding.profile,
          nextCursor: null,
          generatedAt: currentOnboarding.generatedAt,
          actions: [{
            id: "save-private-profile",
            label: "Save private profile",
            tool: actionTool,
            input: { workspaceScope: "global", action: savedProfile },
          }],
        };
      }
      return {
        view: "home",
        data: {
          profile: currentOnboarding.profile ? {
            handle: currentOnboarding.profile.handle,
            displayName: currentOnboarding.profile.displayName,
            updatedAt: Date.parse(currentOnboarding.generatedAt),
          } : null,
          pulse: currentOnboarding.networking ? { expiresAt: currentOnboarding.networking.expiresAt } : null,
          watch: null,
          counts: { matches: 0, connections: 0, rooms: currentOnboarding.holdings.rooms, circles: currentOnboarding.holdings.circles },
        },
        nextCursor: null,
        generatedAt: currentOnboarding.generatedAt,
      };
    }
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow) return;
      const message = event.data as BridgeEvent;
      events.push(message);
      if (message.method === "ui/initialize" && message.id !== undefined) {
        (window as Window & { __buildmatesBridgeResponse?: unknown }).__buildmatesBridgeResponse = { pending: true };
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2026-01-26", hostContext: { theme: "light" } } }, "*");
        void workspace("home").then((snapshot) => {
          event.source?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: snapshot } }, "*");
        });
        return;
      }
      if (message.method !== "tools/call" || message.id === undefined) return;
      if (message.params?.name === "get_buildmates_workspace") {
        const view = String(message.params.arguments?.view ?? "home");
        void workspace(view).then((snapshot) => {
          (window as Window & { __buildmatesBridgeResponse?: unknown }).__buildmatesBridgeResponse = snapshot;
          event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { structuredContent: snapshot } }, "*");
        }).catch((error) => {
          (window as Window & { __buildmatesBridgeError?: string }).__buildmatesBridgeError = error instanceof Error ? error.message : String(error);
          event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { isError: true } }, "*");
        });
        return;
      }
      if (message.params?.name === actionTool) {
        const input = message.params.arguments ?? {};
        const action = input.action as { kind?: string; profile?: Record<string, unknown> } | undefined;
        if (action?.kind !== "save_profile" || !action.profile) {
          event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { isError: true } }, "*");
          return;
        }
        currentOnboarding = {
          ...currentOnboarding,
          profile: { ...(currentOnboarding.profile ?? {}), ...action.profile },
        };
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { structuredContent: { action: "save_profile", confirmationState: "persisted", details: { profileId: currentOnboarding.profile?.id, handle: currentOnboarding.profile?.handle } } } }, "*");
      }
    });
    frame.srcdoc = html;
  }, { html: BUILD_MATES_CHAT_UI_HTML, actionTool, savedProfile, onboarding: onboardingState });

  const workspace = page.frameLocator("#workspace");
  await page.waitForTimeout(3_000);
  const bridgeDebug = await page.evaluate(() => ({
    parentHref: window.location.href,
    frameHref: (() => { try { return document.querySelector<HTMLIFrameElement>("#workspace")?.contentWindow?.location.href ?? null; } catch { return "unreadable"; } })(),
    error: (window as Window & { __buildmatesBridgeError?: string }).__buildmatesBridgeError ?? null,
    events: (window as Window & { __buildmatesEvents?: BridgeEvent[] }).__buildmatesEvents ?? [],
    response: (window as Window & { __buildmatesBridgeResponse?: unknown }).__buildmatesBridgeResponse ?? null,
  }));
  expect(bridgeDebug.error, JSON.stringify(bridgeDebug.events)).toBeNull();
  expect(bridgeErrors, bridgeErrors.join("\n")).toEqual([]);
  expect(bridgeDebug.events.some((event) => event.method === "ui/initialize"), JSON.stringify(bridgeDebug.events)).toBe(true);
  expect(bridgeDebug.response, JSON.stringify(bridgeDebug.events)).not.toBeNull();
  await expect(workspace.locator("h1")).toHaveText("Overview", { timeout: 10_000 });

  await workspace.getByRole("tab", { name: "Profile" }).click();
  await expect(workspace.getByRole("button", { name: "Save private profile" })).toBeVisible();
  await workspace.getByRole("button", { name: "Save private profile" }).click();
  await expect(workspace.locator("h1")).toHaveText("Profile");
  await expect(workspace.locator("#main").getByText("I build reliable tools for small software teams.")).toBeVisible();
  await expect(workspace.getByRole("status")).toHaveText("Saved.");

  const events = await page.evaluate(() => (window as Window & { __buildmatesEvents?: BridgeEvent[] }).__buildmatesEvents ?? []);
  const initialize = events.find((event) => event.method === "ui/initialize");
  expect(initialize?.params).toMatchObject({
    appInfo: { name: "buildmates-workspace-v1" },
    appCapabilities: { availableDisplayModes: ["inline"] },
  });
  const workspaceCall = events.find((event) => event.method === "tools/call" && event.params?.name === "get_buildmates_workspace");
  expect(workspaceCall?.params?.arguments).toMatchObject({ view: "profile", workspaceScope: "global", limit: 20 });
  const actionCall = events.find((event) => event.method === "tools/call" && event.params?.name === actionTool);
  expect(actionCall?.params?.arguments).toMatchObject({ workspaceScope: "global", action: { kind: "save_profile" } });
  expect(actionCall?.params?.arguments?.idempotencyKey).toEqual(expect.any(String));
  expect(chatActionSchema.safeParse(actionCall?.params?.arguments?.action).success).toBe(true);

  await page.goto("/install");
  const persisted = await page.evaluate(async ({ handle, nextProfile }) => {
    const response = await fetch(`/api/profiles/${encodeURIComponent(handle)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextProfile),
    });
    const body = await response.text();
    const refreshed = await fetch("/api/onboarding", { cache: "no-store" });
    return { ok: response.ok, status: response.status, body, refreshed: await refreshed.json() as { profile?: { summary?: string } | null } };
  }, { handle, nextProfile: { ...profile.profile, summary: "I build reliable tools for small software teams." } });
  expect(persisted.ok, persisted.body).toBe(true);
  expect(persisted.refreshed.profile?.summary).toBe("I build reliable tools for small software teams.");

});

test("MCP Apps bridge ignores a forged origin after it has established the host origin", async ({ page }) => {
  await page.setContent('<iframe id="workspace" title="Buildmates workspace"></iframe>');
  await page.evaluate((html) => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    if (!frame) throw new Error("workspace_frame_missing");
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow || event.data?.method !== "ui/initialize") return;
      event.source?.postMessage({ jsonrpc: "2.0", id: event.data.id, result: { protocolVersion: "2026-01-26" } }, "*");
    });
    frame.srcdoc = html;
  }, BUILD_MATES_CHAT_UI_HTML);
  const workspace = page.frameLocator("#workspace");
  await expect(workspace.locator("#context")).toHaveText("Your building network, in the conversation.", { timeout: 10_000 });
  const before = await workspace.locator("#context").textContent();

  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    if (!frame?.contentWindow) throw new Error("workspace_frame_missing");
    frame.contentWindow.dispatchEvent(new MessageEvent("message", {
      source: window,
      origin: "https://evil.example",
      data: { jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "dark" } },
    }));
  });

  await expect(workspace.locator("#context")).toHaveText(before ?? "");
  await expect(workspace.locator("html")).not.toHaveAttribute("data-theme", "dark");
});

test("MCP Apps room composer requires confirmation before sending a relationship action", async ({ page }) => {
  await page.goto("about:blank");
  await page.setContent('<iframe id="workspace" title="Buildmates workspace"></iframe>');
  await page.evaluate((html) => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    if (!frame) throw new Error("workspace_frame_missing");
    const events: BridgeEvent[] = [];
    (window as Window & { __buildmatesEvents?: BridgeEvent[] }).__buildmatesEvents = events;
    const roomId = "room_demo";
    let messages: Array<{ author: string; body: string }> = [];
    const snapshot = () => ({
      view: "room",
      subjectId: roomId,
      data: {
        room: { id: roomId, title: "A room for the next useful step", summary: "A private room for builders who chose to continue.", state: "active", memberCount: 2 },
        messages,
        composer: {
          label: "Send message",
          placeholder: "Write to the room",
          requiresConfirmation: true,
          action: {
            tool: "perform_buildmates_relationship_action",
            input: { workspaceScope: "global", action: { kind: "send_room_message", roomId, body: "" } },
          },
        },
      },
      nextCursor: null,
      generatedAt: new Date().toISOString(),
    });
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow) return;
      const message = event.data as BridgeEvent;
      events.push(message);
      if (message.method === "ui/initialize" && message.id !== undefined) {
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2026-01-26" } }, "*");
        event.source?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: snapshot() } }, "*");
        return;
      }
      if (message.method !== "tools/call" || message.id === undefined) return;
      if (message.params?.name === "get_buildmates_workspace") {
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { structuredContent: snapshot() } }, "*");
        return;
      }
      if (message.params?.name === "perform_buildmates_relationship_action") {
        const input = message.params.arguments ?? {};
        const action = input.action as { kind?: string; body?: string; roomId?: string } | undefined;
        if (action?.kind !== "send_room_message" || action.roomId !== roomId || !action.body || input.workspaceScope !== "global") {
          event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { isError: true } }, "*");
          return;
        }
        messages = [{ author: "You", body: action.body }];
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { structuredContent: snapshot() } }, "*");
      }
    });
    frame.srcdoc = html;
  }, BUILD_MATES_CHAT_UI_HTML);

  const workspace = page.frameLocator("#workspace");
  await expect(workspace.locator("h1")).toHaveText("Room", { timeout: 10_000 });
  const composer = workspace.locator("textarea[aria-label='Send message']");
  await composer.fill("I can take the first implementation pass.");
  const send = workspace.locator("form.composer button");
  await send.click();
  await expect(send).toHaveText("Confirm send");
  await expect(workspace.getByRole("status")).toHaveText("Review your message, then press Confirm send.");
  await send.click();
  await expect(workspace.getByRole("status")).toHaveText("Saved.");
  await expect(workspace.locator(".message")).toContainText("I can take the first implementation pass.");

  const events = await page.evaluate(() => (window as Window & { __buildmatesEvents?: BridgeEvent[] }).__buildmatesEvents ?? []);
  const actionCall = events.find((event) => event.method === "tools/call" && event.params?.name === "perform_buildmates_relationship_action");
  expect(actionCall?.params?.arguments).toMatchObject({ workspaceScope: "global", action: { kind: "send_room_message", roomId: "room_demo", confirmation: "confirmed" } });
  expect(actionCall?.params?.arguments?.idempotencyKey).toEqual(expect.any(String));
  expect(actionCall?.params?.arguments?.action?.clientMessageId).toEqual(expect.any(String));
  expect(chatActionSchema.safeParse(actionCall?.params?.arguments?.action).success).toBe(true);
});

test("MCP Apps bridge presents a recovery action when the host rejects an update", async ({ page }) => {
  await page.goto("about:blank");
  await page.setContent('<iframe id="workspace" title="Buildmates workspace"></iframe>');
  await page.evaluate((html) => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    if (!frame) throw new Error("workspace_frame_missing");
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow) return;
      const message = event.data as BridgeEvent;
      if (message.method === "ui/initialize" && message.id !== undefined) {
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2026-01-26" } }, "*");
        event.source?.postMessage({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: {
            structuredContent: {
              view: "home",
              data: {
                setup: {
                  message: "A reviewed profile is ready for one last check.",
                  actions: [{
                    id: "mark-setup-reviewed",
                    label: "Mark setup reviewed",
                    tool: "perform_buildmates_action",
                    input: { workspaceScope: "global", action: { kind: "mark_activity_read", all: true } },
                  }],
                },
              },
              nextCursor: null,
              generatedAt: new Date().toISOString(),
            },
          },
        }, "*");
        return;
      }
      if (message.method === "tools/call" && message.id !== undefined && message.params?.name === "perform_buildmates_action") {
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { isError: true } }, "*");
      }
    });
    frame.srcdoc = html;
  }, BUILD_MATES_CHAT_UI_HTML);

  const workspace = page.frameLocator("#workspace");
  await expect(workspace.locator("h1")).toHaveText("Overview", { timeout: 10_000 });
  await workspace.getByRole("button", { name: "Mark setup reviewed" }).click();
  await expect(workspace.getByRole("status")).toHaveText("Buildmates could not complete that action. Check the workspace before trying again.");
  await expect(workspace.getByRole("button", { name: "Refresh workspace" })).toBeVisible();
});

test("MCP Apps private preview stays sandboxed inside the canonical widget", async ({ page }) => {
  await page.goto("about:blank");
  await page.setContent('<iframe id="workspace" title="Buildmates workspace"></iframe>');
  await page.evaluate((html) => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    if (!frame) throw new Error("workspace_frame_missing");
    (window as Window & { __previewEscaped?: boolean }).__previewEscaped = false;
    window.addEventListener("message", (event) => {
      if (event.data?.type === "preview-escape") (window as Window & { __previewEscaped?: boolean }).__previewEscaped = true;
      if (event.source !== frame.contentWindow) return;
      const message = event.data as BridgeEvent;
      if (message.method === "ui/initialize" && message.id !== undefined) {
        event.source?.postMessage({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2026-01-26" } }, "*");
        event.source?.postMessage({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: {
            structuredContent: {
              view: "home",
              surfacePreview: {
                kind: "profile_preview",
                label: "Private profile preview",
                html: "<p id='preview-copy'>Only you can see this draft.</p><script>document.body.dataset.executed='true'; parent.postMessage({type:'preview-escape'}, '*')</script>",
                desktopMinHeight: 240,
                phoneMinHeight: 240,
              },
              data: { profile: null, counts: { matches: 0, connections: 0, rooms: 0, circles: 0 } },
              nextCursor: null,
              generatedAt: new Date().toISOString(),
            },
          },
        }, "*");
      }
    });
    frame.srcdoc = html;
  }, BUILD_MATES_CHAT_UI_HTML);

  const workspace = page.frameLocator("#workspace");
  const preview = workspace.locator("iframe.preview-frame");
  await expect(preview).toHaveAttribute("sandbox", "");
  await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(preview.contentFrame().locator("#preview-copy")).toHaveText("Only you can see this draft.");
  await expect(preview.contentFrame().locator("body")).not.toHaveAttribute("data-executed", "true");
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as Window & { __previewEscaped?: boolean }).__previewEscaped)).toBe(false);
});
