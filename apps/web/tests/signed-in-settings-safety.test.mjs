import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("every signed-in settings route uses one discoverable settings shell", async () => {
  const componentRoot = new URL("../components/settings/", import.meta.url);
  const settingsRoot = new URL("../app/settings/", import.meta.url);
  const [shell, privacy, automation, connections, safety] = await Promise.all([
    readFile(new URL("SettingsShell.tsx", componentRoot), "utf8"),
    readFile(new URL("privacy/page.tsx", settingsRoot), "utf8"),
    readFile(new URL("automation/page.tsx", settingsRoot), "utf8"),
    readFile(new URL("connections/page.tsx", settingsRoot), "utf8"),
    readFile(new URL("safety/page.tsx", settingsRoot), "utf8"),
  ]);

  for (const [href, label] of [
    ["/settings/privacy", "Profile & privacy"],
    ["/settings/automation", "Networking & Work Pulse"],
    ["/settings/connections", "Codex connection"],
    ["/settings/safety", "Safety"],
  ]) {
    assert.match(shell, new RegExp(href.replaceAll("/", "\\/")));
    assert.match(shell, new RegExp(label.replaceAll("&", "&")));
  }
  assert.match(shell, /aria-label="Settings sections"/);
  assert.match(shell, /aria-current=\{current === section\.id \? "page"/);
  assert.match(privacy, /current="privacy"/);
  assert.match(automation, /current="automation"/);
  assert.match(connections, /current="connections"/);
  assert.match(safety, /current="safety"/);
  assert.doesNotMatch(connections, /SignOutButton|className=\{styles\.account\}/);
});

test("report actions collect a typed reason and optional details before calling the safety API", async () => {
  const componentRoot = new URL("../components/safety/", import.meta.url);
  const appRoot = new URL("../app/", import.meta.url);
  const [dialog, connections, room, circle] = await Promise.all([
    readFile(new URL("SafetyReportDialog.tsx", componentRoot), "utf8"),
    readFile(new URL("connections/ConnectionsClient.tsx", appRoot), "utf8"),
    readFile(new URL("rooms/[id]/RoomClient.tsx", appRoot), "utf8"),
    readFile(new URL("circles/[id]/CircleClient.tsx", appRoot), "utf8"),
  ]);

  assert.match(dialog, /fetch\("\/api\/safety"/);
  assert.match(dialog, /action: "report"/);
  for (const reason of [
    "spam",
    "harassment",
    "impersonation",
    "unsafe_content",
    "privacy",
    "other",
  ]) {
    assert.match(dialog, new RegExp(`value: "${reason}"`));
  }
  assert.match(dialog, /maxLength=\{2000\}/);
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /aria-labelledby/);
  assert.match(dialog, /Submit private report/);
  assert.doesNotMatch(`${connections}\n${room}`, /Reported from .* controls/);
  assert.match(connections, /targetKind="room"/);
  assert.match(room, /targetKind="room"/);
  assert.match(circle, /targetKind="circle"/);
});
