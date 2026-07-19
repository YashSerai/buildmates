import { readFile, readdir } from "node:fs/promises";
import { createD1McpProductRepository } from "@buildmates/mcp-core";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyQaScenario, resetQaScenarios } from "../../apps/web/src/testing/qa-scenarios";

describe("Work Pulse QA scenarios", () => {
  let mf: Miniflare;
  let DB: D1Database;
  const viewerUserId = "qa-scenario-viewer";
  const now = Date.parse("2026-07-19T04:00:00Z");

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {fetch(){return new Response('ok')}}",
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-22",
    });
    DB = (await mf.getD1Database("DB")) as D1Database;
    for (const name of (await readdir("apps/web/drizzle")).filter((item) => item.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${name}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) {
        await DB.prepare(statement).run();
      }
    }
    await DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at)VALUES(?,'active','none',?,?)")
      .bind(viewerUserId, now, now).run();
  }, 30_000);

  afterEach(async () => mf.dispose());

  it("runs cumulative activity, preserves a true no-change digest, and cleans up", async () => {
    const candidates = await applyQaScenario(DB, viewerUserId, "candidate_spectrum", now);
    expect(candidates).toMatchObject({ changed: true, digest: { candidates: 5, pendingProposals: 0 } });
    await expect(applyQaScenario(DB, viewerUserId, "candidate_spectrum", now + 1)).resolves.toMatchObject({ changed: false });

    const interest = await applyQaScenario(DB, viewerUserId, "incoming_interest", now + 2);
    expect(interest.digest).toMatchObject({ candidates: 5, pendingProposals: 1 });
    const connected = await applyQaScenario(DB, viewerUserId, "reciprocal_connection", now + 3);
    expect(connected.digest).toMatchObject({ connections: 1 });
    const message = await applyQaScenario(DB, viewerUserId, "new_message", now + 4);
    expect(message.digest).toMatchObject({ messages: 4 });
    const repository = createD1McpProductRepository(DB);
    const roomAfterConversation = await repository.readForMember<Record<string, unknown>>("room", message.roomId, viewerUserId);
    expect(roomAfterConversation?.value).toMatchObject({
      conversation: { messageCount: 4, meaningful: true },
      feedback: { submittedByViewer: false, positiveFromViewer: false },
      upgradeState: "none",
    });
    expect(JSON.stringify(roomAfterConversation)).not.toContain("smallest reproducible examples");
    const circle = await applyQaScenario(DB, viewerUserId, "circle_invitation", now + 5);
    expect(circle.digest).toMatchObject({ circleInvitations: 1 });
    const relevance = await applyQaScenario(DB, viewerUserId, "renewed_relevance", now + 6);
    expect(relevance.digest).toMatchObject({ renewedRelevanceUpdates: 1 });
    const feedback = await applyQaScenario(DB, viewerUserId, "positive_feedback", now + 7);
    expect(feedback.digest).toMatchObject({ positiveFeedback: 1 });
    await expect(repository.readForMember<Record<string, unknown>>("room", feedback.roomId, viewerUserId)).resolves.toMatchObject({
      value: {
        conversation: { messageCount: 4, meaningful: true },
        feedback: { submittedByViewer: true, positiveFromViewer: true },
        upgradeState: "none",
      },
    });

    const permission = await applyQaScenario(DB, viewerUserId, "permission_exclusion", now + 8);
    expect(await DB.prepare("SELECT audience,allow_matching AS allowMatching,value_json AS valueJson FROM profile_fields WHERE profile_id=? AND field_key='qa_private_fact'")
      .bind(`qa_qascenarioviewer_profile_excluded`).first()).toEqual({
      audience: "private",
      allowMatching: 0,
      valueJson: JSON.stringify("QA_PRIVATE_SENTINEL_NEVER_RENDER"),
    });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM matching_exclusions WHERE user_id=? AND normalized_value=?")
      .bind(viewerUserId, permission.candidateUserIds.excluded).first()).toEqual({ count: 1 });

    const quiet = await applyQaScenario(DB, viewerUserId, "no_change", now + 9);
    expect(quiet.changed).toBe(false);
    expect(quiet.digest).toEqual(permission.digest);

    await resetQaScenarios(DB, viewerUserId);
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM users WHERE id LIKE 'qa_qascenarioviewer_%'").first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM connections WHERE id=?").bind(quiet.connectionId).first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM circles WHERE id=?").bind(quiet.circleId).first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND id LIKE 'qa_qascenarioviewer_%'").bind(viewerUserId).first()).toEqual({ count: 0 });
  });
});
