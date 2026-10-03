import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { createD1McpProductRepository, executeBuildmatesTool, type BuildmatesToolServices } from "@buildmates/mcp-core";
import { createCircle } from "../../apps/web/src/circles/service";
import { performChatAction } from "../../apps/web/src/platform/chat-operations";
import type { R2Like } from "../../apps/web/src/platform/r2";
import { applyD1Migrations } from "../helpers/migrate-d1";

const SUBJECT = "mcp_subject_idempotency_test";
const USER_ID = "user_idempotency";
const NOW = "2026-10-02T12:00:00.000Z";
const AT = Date.parse(NOW);

describe("MCP idempotency unknown-outcome boundaries", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES (?,?,?,?,?)").bind(USER_ID, "active", "none", AT, AT).run();
  });

  afterEach(async () => mf.dispose());

  it("completes the outer D1 receipt for a grouped account deletion", async () => {
    const assets: R2Like = { async put() {}, async get() { return null; }, async delete() {} };
    const repository = createD1McpProductRepository(DB);
    const services = servicesFor(repository, async ({ userId, action, now, idempotencyKey }) => performChatAction(DB, { userId, action, now, idempotencyKey }, assets));

    const prepared = await executeBuildmatesTool("perform_buildmates_action", {
      action: { kind: "prepare_account_deletion" },
      idempotencyKey: "prepare-delete-receipt",
      workspaceScope: "global",
    }, SUBJECT, services) as { result: { details: { receipt: string } } };

    const input = {
      action: { kind: "request_deletion", receipt: prepared.result.details.receipt, confirmation: "DELETE BUILDMATES" },
      idempotencyKey: "grouped-delete-once",
      workspaceScope: "global",
    };
    const first = await executeBuildmatesTool("perform_buildmates_action", input, SUBJECT, services) as { replayed: boolean; result: { confirmationState: string; details: { status: string; jobId: string } } };
    expect(first).toMatchObject({ replayed: false, result: { confirmationState: "completed", details: { status: "complete" } } });

    const stored = await DB.prepare("SELECT status,response_json AS responseJson FROM idempotency_keys WHERE actor_user_id=? AND operation='perform_buildmates_action' AND key_hash=?").bind(USER_ID, await sha256("grouped-delete-once")).first<{ status: string; responseJson: string | null }>();
    expect(stored?.status).toBe("complete");
    expect(stored?.responseJson).toContain('"status":"complete"');

    const replay = await executeBuildmatesTool("perform_buildmates_action", input, SUBJECT, services) as { replayed: boolean; result: { details: { status: string; jobId: string } } };
    expect(replay).toMatchObject({ replayed: true, result: { details: { status: "complete", jobId: first.result.details.jobId } } });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM deletion_jobs WHERE user_id=?").bind(USER_ID).first()).resolves.toEqual({ count: 1 });
  }, 30_000);

  it("does not rerun a Circle effect that throws after its random ID is written", async () => {
    const repository = createD1McpProductRepository(DB);
    const createdCircleIds: string[] = [];
    const services = servicesFor(repository, async ({ userId, action, now }) => {
      if (action.kind !== "create_circle") throw new Error("unexpected_action");
      const created = await createCircle(DB, { actorId: userId, name: action.name, purpose: action.purpose, governanceMode: action.governanceMode, inviteeUserIds: action.inviteeUserIds, now: Date.parse(now) });
      createdCircleIds.push(created.id);
      throw new Error("circle_effect_uncertain");
    });
    const input = {
      action: { kind: "create_circle", name: "Shared builders", purpose: "A shared test Circle", governanceMode: "admin", inviteeUserIds: [], confirmation: "confirmed" },
      idempotencyKey: "circle-effect-throws",
      workspaceScope: "global",
    };

    await expect(executeBuildmatesTool("perform_buildmates_circle_action", input, SUBJECT, services)).rejects.toThrow("circle_effect_uncertain");
    await expect(executeBuildmatesTool("perform_buildmates_circle_action", input, SUBJECT, services)).rejects.toThrow("idempotency_in_progress");
    expect(createdCircleIds).toHaveLength(1);
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM circles WHERE id=?").bind(createdCircleIds[0]).first()).resolves.toEqual({ count: 1 });
  }, 30_000);

  it("does not replay an effect when the D1 completion receipt fails", async () => {
    const repository = createD1McpProductRepository(DB);
    let effectCount = 0;
    const key = "completion-receipt-fails";
    await DB.prepare("CREATE TRIGGER fail_idempotency_completion BEFORE UPDATE OF status ON idempotency_keys WHEN NEW.status='complete' BEGIN SELECT RAISE(ABORT,'simulated_completion_receipt_failure'); END").run();

    await expect(repository.runIdempotent({
      actorUserId: USER_ID,
      operation: "completion_receipt_test",
      key,
      requestHash: "same-request",
      now: NOW,
      execute: async () => {
        effectCount += 1;
        return { effect: "written-once" };
      },
    })).rejects.toThrow("simulated_completion_receipt_failure");
    await expect(repository.runIdempotent({
      actorUserId: USER_ID,
      operation: "completion_receipt_test",
      key,
      requestHash: "same-request",
      now: NOW,
      execute: async () => {
        effectCount += 1;
        return { effect: "must-not-rerun" };
      },
    })).rejects.toThrow("idempotency_in_progress");
    expect(effectCount).toBe(1);
    await expect(DB.prepare("SELECT status,response_json AS responseJson FROM idempotency_keys WHERE actor_user_id=? AND operation=?").bind(USER_ID, "completion_receipt_test").first()).resolves.toMatchObject({ status: "processing", responseJson: null });
  }, 30_000);
});

function servicesFor(repository: ReturnType<typeof createD1McpProductRepository>, perform: NonNullable<BuildmatesToolServices["performChatAction"]>): BuildmatesToolServices {
  return {
    linkBaseUrl: "https://buildmates.example",
    repository,
    completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }),
    allowAttempt: async () => true,
    resolveLinkedUser: async ({ mcpSubject }) => mcpSubject === SUBJECT ? { userId: USER_ID } : null,
    validateTaxonomy: async () => true,
    performChatAction: perform,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
