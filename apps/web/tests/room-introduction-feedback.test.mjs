import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../app/", import.meta.url);
const sourceRoot = new URL("../src/", import.meta.url);

test("a room offers one inline introduction review plus Codex and copy routes", async () => {
  const room = await readFile(
    new URL("rooms/[id]/RoomClient.tsx", appRoot),
    "utf8",
  );

  assert.match(room, /Review the introduction/);
  assert.match(room, /RoomFeedbackForm/);
  assert.match(room, /action: "feedback"/);
  assert.match(room, /Review with Codex/);
  assert.match(room, /Copy review prompt/);
  assert.match(room, /codex:\/\/open\?prompt=/);
  assert.match(room, /get_room_summaries/);
  assert.match(room, /submit_intro_feedback only after I answer/);
  assert.match(room, /Do not claim to create or activate/);
  assert.match(room, /both members must approve/);
  assert.doesNotMatch(room, /\/connections#/);
  assert.equal(room.match(/Shared room tools/g)?.length, 1);
  assert.doesNotMatch(room, />Room tools</);
});

test("room feedback uses canonical connection storage and positive feedback only unlocks a proposal", async () => {
  const [route, lifecycle] = await Promise.all([
    readFile(new URL("api/rooms/[id]/lifecycle/route.ts", appRoot), "utf8"),
    readFile(new URL("rooms/lifecycle.ts", sourceRoot), "utf8"),
  ]);

  assert.match(route, /action:z\.literal\("feedback"\)/);
  assert.match(route, /saveIntroductionFeedback\(DB/);
  assert.match(lifecycle, /INSERT INTO introduction_feedback/);
  assert.match(lifecycle, /upgradeEligible:Boolean\(feedback\?\.useful\)/);

  assert.match(
    lifecycle,
    /room_upgrade_proposals[\s\S]*'proposed'/,
    "positive feedback may create only a proposed upgrade",
  );
  assert.match(
    lifecycle,
    /room_upgrade_responses[\s\S]*'accepted'/,
    "the proposer records their own approval",
  );
  assert.match(
    lifecycle,
    /2=\(SELECT COUNT\(\*\)[\s\S]*response='accepted'/,
    "activation still requires both active room members",
  );
});
