import { expect, test, type Page } from "@playwright/test";
import { BUILD_MATES_CHAT_UI_HTML } from "@buildmates/mcp-core";

type FixtureMode =
  | "safe"
  | "empty"
  | "delayed-empty"
  | "read-error"
  | "malformed"
  | "timeout"
  | "initial-error"
  | "hold-initialize"
  | "composer-retry";

type MountOptions = {
  mode?: FixtureMode;
  initialView?: "home" | "room";
  hostileText?: string;
  includePreview?: boolean;
  installClock?: boolean;
};

type BridgeEvent = {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
};

const shell = `
  <style>html,body{margin:0;width:100%;min-width:0;background:#f3f0e7}#workspace{display:block;width:100%;height:900px;border:0}</style>
  <iframe id="workspace" title="Buildmates workspace"></iframe>
`;

async function mountWidget(page: Page, options: MountOptions = {}) {
  await page.goto("about:blank");
  if (options.installClock) await page.clock.install();
  await page.setContent(shell);
  await page.evaluate(
    ({ html, options }) => {
      const frame = document.querySelector<HTMLIFrameElement>("#workspace");
      if (!frame) throw new Error("workspace_frame_missing");
      const mode = options.mode ?? "safe";
      const initialView = options.initialView ?? "home";
      const hostileText = options.hostileText ?? "A useful Buildmates update.";
      const events: BridgeEvent[] = [];
      let actionAttempts = 0;
      let initializeMessage: BridgeEvent | null = null;

      const roomSnapshot = () => ({
        view: "room",
        subjectId: "room-edge",
        data: {
          room: {
            id: "room-edge",
            title: "Edge case room",
            summary: "A room used for interaction checks.",
            status: "active",
            memberCount: 2,
            otherName: "Grace",
          },
          messages: [{ authorLabel: "Grace", body: hostileText, mine: false }],
          composer: {
            label: "Send message",
            placeholder: "Write to the room",
            requiresConfirmation: true,
            action: {
              tool: "perform_buildmates_relationship_action",
              input: {
                workspaceScope: "global",
                action: { kind: "send_room_message", roomId: "room-edge", body: "" },
              },
            },
          },
        },
      });

      const profileSnapshot = () => ({
        view: "profile",
        data: {
          profile: {
            displayName: "<img src=x onerror=alert(1)>",
            summary: hostileText,
            handle: "edge-builder",
            fields: [{ key: "bio", value: hostileText }],
          },
        },
      });

      const snapshotFor = (view: string) => {
        if (view === "room") return roomSnapshot();
        if (view === "profile") return profileSnapshot();
        if (mode === "empty" || mode === "delayed-empty") return { view: "home", data: {} };
        return {
          view: "home",
          data: {
            profile: { displayName: "Edge builder", summary: hostileText, handle: "edge-builder" },
            counts: { rooms: 1, circles: 0 },
          },
        };
      };

      function reply(event: MessageEvent, message: BridgeEvent, result?: unknown, error?: unknown) {
        const response: Record<string, unknown> = { jsonrpc: "2.0", id: message.id };
        if (error) response.error = error;
        else response.result = result;
        postToSource(event, response);
      }

      function notify(event: MessageEvent, snapshot: unknown) {
        const params: Record<string, unknown> = { structuredContent: snapshot };
        if (options.includePreview) {
          params._meta = {
            surfacePreview: {
              kind: "profile_preview",
              label: "Private profile preview",
              html: "<p id='preview-copy'>Only you can see this draft.</p><script>document.body.dataset.executed='true'; parent.postMessage({type:'preview-escape'}, '*')</script>",
              desktopMinHeight: 240,
              phoneMinHeight: 240,
            },
          };
        }
        postToSource(event, {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params,
        });
      }

      function postToSource(event: MessageEvent, message: unknown) {
        const source = event.source as unknown as { postMessage: (value: unknown, targetOrigin: string) => void } | null;
        source?.postMessage(message, "*");
      }

      function releaseInitialize() {
        if (!initializeMessage) return;
        const event = { source: frame.contentWindow } as unknown as MessageEvent;
        reply(event, initializeMessage, { protocolVersion: "2026-01-26", hostContext: { theme: "light" } });
        notify(event, snapshotFor(initialView));
        initializeMessage = null;
      }

      (window as Window & {
        __widgetEvents?: BridgeEvent[];
        __widgetInitSeen?: boolean;
        __widgetInitId?: number;
        __releaseWidgetInitialize?: () => void;
      }).__widgetEvents = events;
      window.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const message = event.data as BridgeEvent;
        events.push(message);
        if (message.method === "ui/initialize" && message.id !== undefined) {
          (window as Window & { __widgetInitSeen?: boolean }).__widgetInitSeen = true;
          (window as Window & { __widgetInitId?: number }).__widgetInitId = message.id;
          if (mode === "initial-error") {
            reply(event, message, undefined, { code: -32000, message: "Host initialization denied." });
          } else if (mode === "hold-initialize") {
            initializeMessage = message;
            (window as Window & { __releaseWidgetInitialize?: () => void }).__releaseWidgetInitialize = releaseInitialize;
          } else {
            reply(event, message, { protocolVersion: "2026-01-26", hostContext: { theme: "light" } });
            if (mode !== "delayed-empty") notify(event, snapshotFor(initialView));
          }
          return;
        }
        if (message.method !== "tools/call" || message.id === undefined) return;
        const name = message.params?.name;
        if (name === "get_buildmates_workspace") {
          if (mode === "timeout") return;
          if (mode === "read-error" || mode === "malformed" || (mode === "composer-retry" && actionAttempts >= 2)) {
            if (mode === "malformed") {
              reply(event, message, {});
              return;
            }
            reply(event, message, { isError: true });
            return;
          }
          reply(event, message, { structuredContent: snapshotFor(String(message.params?.arguments?.view ?? "home")) });
          return;
        }
        if (name === "perform_buildmates_relationship_action") {
          actionAttempts += 1;
          if (mode === "composer-retry" && actionAttempts === 1) {
            reply(event, message, { isError: true });
            return;
          }
          if (mode === "composer-retry" && actionAttempts === 2) {
            reply(event, message, {});
            return;
          }
          reply(event, message, { structuredContent: roomSnapshot() });
        }
      });
      (window as Window & { __widgetReleaseDelayed?: () => void }).__widgetReleaseDelayed = () => {
        const event = { source: frame.contentWindow } as unknown as MessageEvent;
        notify(event, snapshotFor(initialView));
      };
      frame.srcdoc = html;
    },
    { html: BUILD_MATES_CHAT_UI_HTML, options },
  );
  return page.frameLocator("#workspace");
}

async function widgetEvents(page: Page) {
  return page.evaluate(() => (window as Window & { __widgetEvents?: BridgeEvent[] }).__widgetEvents ?? []);
}

test("keeps keyboard focus, hostile text literal, and controls usable at tiny widths", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const hostileText = [
    "مرحبا بالعالم שלום עולם 👩🏽‍💻",
    "<script>alert('xss')</script><img src=x onerror=alert(1)>",
    "長いテキスト ".repeat(80),
  ].join("\n");
  await page.setViewportSize({ width: 280, height: 760 });
  const workspace = await mountWidget(page, { initialView: "room", hostileText });
  await expect(workspace.locator("h1")).toHaveText("Room");

  const message = workspace.locator(".message p").first();
  expect(await message.textContent()).toBe(hostileText);
  await expect(message.locator("img, script")).toHaveCount(0);
  const composer = workspace.locator("textarea[aria-label='Send message']");
  await expect(composer).toBeVisible();
  await composer.fill("A draft for Grace, مرحبا");
  await workspace.locator("form.composer").screenshot({ path: testInfo.outputPath("widget-edge-room-composer-280.png") });
  await page.screenshot({ path: testInfo.outputPath("widget-edge-room-280.png"), fullPage: true });
  await workspace.getByRole("link", { name: "Skip to workspace" }).focus();
  await workspace.getByRole("link", { name: "Skip to workspace" }).press("Enter");
  await expect(workspace.locator("#main")).toBeFocused();

  const profileTab = workspace.getByRole("tab", { name: "Profile" });
  await profileTab.focus();
  await profileTab.press("Enter");
  await expect(workspace.locator("h1")).toHaveText("Profile");
  await expect(profileTab).toHaveAttribute("aria-selected", "true");
  await expect(workspace.locator("#main")).toBeFocused();

  for (const width of [280, 240]) {
    await page.setViewportSize({ width, height: 760 });
    const metrics = await workspace.locator("html").evaluate((html) => ({
      clientWidth: html.clientWidth,
      scrollWidth: html.scrollWidth,
      shortButtons: Array.from(html.querySelectorAll("button"))
        .map((button) => button.getBoundingClientRect().height)
        .filter((height) => height > 0 && height < 44),
    }));
    expect(metrics.scrollWidth, `widget overflow at ${width}px`).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.shortButtons, `small controls at ${width}px`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`widget-edge-${width}.png`), fullPage: true });
  }
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("shows loading and honest empty/read-error states", async ({ page }) => {
  const workspace = await mountWidget(page, { mode: "delayed-empty" });
  await expect(workspace.getByText("Loading your workspace")).toBeVisible();
  await page.evaluate(() => (window as Window & { __widgetReleaseDelayed?: () => void }).__widgetReleaseDelayed?.());
  await expect(workspace.getByRole("heading", { name: "Finish your profile" })).toBeVisible();
  await expect(workspace.getByText("Buildmates needs a reviewed profile", { exact: false })).toBeVisible();

  await page.reload();
  const erroredWorkspace = await mountWidget(page, { mode: "read-error" });
  await expect(erroredWorkspace.locator("h1")).toHaveText("Overview");
  await erroredWorkspace.getByRole("tab", { name: "Profile" }).click();
  await expect(erroredWorkspace.getByRole("status")).toHaveText("Buildmates could not load that view.");
  await expect(erroredWorkspace.locator("h1")).toHaveText("Overview");

  const malformedWorkspace = await mountWidget(page, { mode: "malformed" });
  await expect(malformedWorkspace.locator("h1")).toHaveText("Overview");
  await malformedWorkspace.getByRole("tab", { name: "Profile" }).click();
  await expect(malformedWorkspace.getByRole("status")).toHaveText("Buildmates returned an invalid workspace snapshot.");
  await expect(malformedWorkspace.locator("h1")).toHaveText("Overview");
});

test("reports initialization rejection, wrong source, and forbidden initial origin", async ({ page }) => {
  const workspace = await mountWidget(page, { mode: "hold-initialize" });
  await page.waitForFunction(() => (window as Window & { __widgetInitSeen?: boolean }).__widgetInitSeen === true);
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#workspace");
    const decoy = document.createElement("iframe");
    document.body.appendChild(decoy);
    if (!frame?.contentWindow || !decoy.contentWindow) throw new Error("workspace_frame_missing");
    const id = (window as Window & { __widgetInitId?: number }).__widgetInitId;
    frame.contentWindow.dispatchEvent(new MessageEvent("message", {
      source: window,
      origin: "https://evil.example",
      data: { jsonrpc: "2.0", id, result: { protocolVersion: "evil" } },
    }));
    frame.contentWindow.dispatchEvent(new MessageEvent("message", {
      source: decoy.contentWindow,
      origin: "null",
      data: { jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "dark" } },
    }));
    (window as Window & { __releaseWidgetInitialize?: () => void }).__releaseWidgetInitialize?.();
  });
  await expect(workspace.locator("h1")).toHaveText("Overview");
  await expect(workspace.locator("html")).not.toHaveAttribute("data-theme", "dark");

  const rejected = await mountWidget(page, { mode: "initial-error" });
  await expect(rejected.getByRole("status")).toHaveText("Open this result in a ChatGPT or Codex host to use Buildmates.");
});

test("keeps a private preview sandboxed and visible", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 760 });
  const workspace = await mountWidget(page, { includePreview: true });
  const preview = workspace.locator("iframe.preview-frame");
  await expect(preview).toHaveAttribute("sandbox", "");
  await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(preview.contentFrame().locator("#preview-copy")).toHaveText("Only you can see this draft.");
  await expect(preview.contentFrame().locator("body")).not.toHaveAttribute("data-executed", "true");
  await page.screenshot({ path: testInfo.outputPath("widget-edge-preview.png"), fullPage: true });
});

test("times out an unanswered host read without a false snapshot", async ({ page }) => {
  const workspace = await mountWidget(page, { mode: "timeout", installClock: true });
  await expect(workspace.locator("h1")).toHaveText("Overview");
  await workspace.getByRole("tab", { name: "Profile" }).click();
  await expect(workspace.getByRole("status")).toHaveText("Loading profile…");
  await page.clock.fastForward(15_001);
  await expect(workspace.getByRole("status")).toHaveText("The Buildmates host did not respond in time.");
  await expect(workspace.locator("h1")).toHaveText("Overview");
});

test("requires confirmation again for a changed retry and reports refresh uncertainty", async ({ page }) => {
  const workspace = await mountWidget(page, { mode: "composer-retry", initialView: "room" });
  await expect(workspace.locator("h1")).toHaveText("Room");
  const composer = workspace.locator("textarea[aria-label='Send message']");
  const send = workspace.locator("form.composer button");

  await composer.fill("First draft");
  await send.click();
  await expect(send).toHaveText("Confirm send");
  await send.click();
  await expect(workspace.getByRole("status")).toHaveText("Buildmates could not complete that action. Check the workspace before trying again.");
  await expect(workspace.getByRole("button", { name: "Refresh workspace" })).toBeVisible();
  await expect(send).toBeEnabled();

  await composer.fill("Second draft");
  await send.click();
  await expect(send).toHaveText("Confirm send");
  await send.click();
  await expect(workspace.getByRole("status")).toHaveText("The action may have saved. Check the workspace before trying again.");
  await expect(workspace.getByRole("button", { name: "Refresh workspace" })).toBeVisible();
  await expect(send).toBeEnabled();

  const actionCalls = (await widgetEvents(page)).filter(
    (event) => event.method === "tools/call" && event.params?.name === "perform_buildmates_relationship_action",
  );
  expect(actionCalls).toHaveLength(2);
  const first = actionCalls[0].params?.arguments ?? {};
  const second = actionCalls[1].params?.arguments ?? {};
  const firstAction = first.action as Record<string, unknown>;
  const secondAction = second.action as Record<string, unknown>;
  expect(firstAction).toMatchObject({ kind: "send_room_message", body: "First draft", confirmation: "confirmed" });
  expect(secondAction).toMatchObject({ kind: "send_room_message", body: "Second draft", confirmation: "confirmed" });
  expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  expect(firstAction).toHaveProperty("clientMessageId");
  expect(secondAction).toHaveProperty("clientMessageId");
  expect(firstAction.clientMessageId).not.toBe(secondAction.clientMessageId);
});
