type BoundStatement = { first<T>(): Promise<T | null>; run(): Promise<{ meta?: { changes?: number } }> };
type Statement = BoundStatement & { bind(...values: unknown[]): BoundStatement };
type Database = { prepare(sql: string): Statement; batch(statements: BoundStatement[]): Promise<Array<{ meta?: { changes?: number } }>> };

export type RecoveryDisposition = "no_effect" | "completed_effect";

export type IdempotencyRecoveryInspection = {
  id: string;
  actorUserId: string;
  operation: string;
  keyHash: string;
  requestHash: string;
  status: "processing" | "complete" | "failed";
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  ageMs: number;
  hasResponse: boolean;
};

export async function inspectIdempotencyRecovery(database: unknown, id: string, now = Date.now()): Promise<IdempotencyRecoveryInspection | null> {
  const DB = database as Database;
  const row = await DB.prepare("SELECT id,actor_user_id AS actorUserId,operation,key_hash AS keyHash,request_hash AS requestHash,status,expires_at AS expiresAt,created_at AS createdAt,updated_at AS updatedAt,response_json IS NOT NULL AS hasResponse FROM idempotency_keys WHERE id=? LIMIT 1").bind(id).first<Omit<IdempotencyRecoveryInspection, "ageMs" | "hasResponse"> & { hasResponse: number }>();
  return row ? { ...row, ageMs: Math.max(0, now - row.updatedAt), hasResponse: Boolean(row.hasResponse) } : null;
}

export async function recoverIdempotencyOperation(database: unknown, input: {
  id: string;
  requestHash: string;
  operatorUserId: string;
  reason: string;
  disposition: RecoveryDisposition;
  effectLocator?: { kind: string; id: string };
  at: Date;
  auditId: string;
}): Promise<boolean> {
  if (input.reason.trim().length < 12 || input.operatorUserId.trim().length < 3) throw new Error("recovery_metadata_invalid");
  if (input.disposition === "completed_effect" && (!input.effectLocator?.kind || !input.effectLocator.id)) throw new Error("effect_locator_required");
  if (input.disposition === "no_effect" && input.effectLocator) throw new Error("effect_locator_not_allowed");
  const DB = database as Database;
  const stuck = await DB.prepare("SELECT actor_user_id AS actorUserId,operation,request_hash AS requestHash,status FROM idempotency_keys WHERE id=? LIMIT 1").bind(input.id).first<{ actorUserId: string; operation: string; requestHash: string; status: string }>();
  if (!stuck || stuck.requestHash !== input.requestHash || stuck.status !== "processing") return false;
  const effect = input.disposition === "completed_effect" ? canonicalEffectPredicate(stuck.operation, stuck.actorUserId, input.effectLocator!) : null;
  const at = input.at.valueOf();
  const nextStatus = input.disposition === "no_effect" ? "failed" : "complete";
  const response = input.disposition === "completed_effect" ? JSON.stringify({ confirmationState: "recovered", effectLocator: input.effectLocator }) : null;
  const metadata = JSON.stringify({ operatorUserId: input.operatorUserId, reason: input.reason, disposition: input.disposition, requestHash: input.requestHash, effectLocator: input.effectLocator ?? null });
  const effectClause = effect ? ` AND EXISTS (${effect.sql})` : "";
  const results = await DB.batch([
    DB.prepare(`UPDATE idempotency_keys SET status=?,response_json=?,updated_at=? WHERE id=? AND actor_user_id=? AND operation=? AND request_hash=? AND status='processing' AND EXISTS (SELECT 1 FROM users operator WHERE operator.id=? AND operator.status='active' AND operator.operator_role='admin')${effectClause}`).bind(nextStatus, response, at, input.id, stuck.actorUserId, stuck.operation, input.requestHash, input.operatorUserId, ...(effect?.values ?? [])),
    DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,idempotency_key,created_at) SELECT ?,?,'idempotency.operator_recovery','idempotency_key',?,?,NULL,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM idempotency_keys WHERE id=? AND actor_user_id=? AND operation=? AND request_hash=? AND status=? AND updated_at=?)").bind(input.auditId, input.operatorUserId, input.id, metadata, at, input.id, stuck.actorUserId, stuck.operation, input.requestHash, nextStatus, at),
  ]);
  return Number(results[0]?.meta?.changes ?? 0) === 1 && Number(results[1]?.meta?.changes ?? 0) === 1;
}

function canonicalEffectPredicate(operation: string, actorUserId: string, locator: { kind: string; id: string }): { sql: string; values: unknown[] } {
  const effects: Record<string, { kind: string; table: string; owner: string }> = {
    submit_work_signal: { kind: "work_signal", table: "work_signals", owner: "user_id" },
    update_networking_pulse: { kind: "networking_pulse", table: "networking_pulses", owner: "user_id" },
    update_profile_model: { kind: "profile", table: "profiles", owner: "user_id" },
    create_invite_link: { kind: "invite", table: "invite_links", owner: "creator_user_id" },
    record_candidate_evaluation: { kind: "candidate_evaluation", table: "codex_evaluations", owner: "user_id" },
    record_manual_match_response: { kind: "manual_match_response", table: "human_responses", owner: "user_id" },
    save_connection_private_note: { kind: "connection_private_note", table: "connection_private_notes", owner: "owner_user_id" },
    schedule_connection_reminder: { kind: "connection_reminder", table: "connection_reminders", owner: "user_id" },
    submit_intro_feedback: { kind: "intro_feedback", table: "introduction_feedback", owner: "user_id" },
    submit_surface_revision: { kind: "surface_revision", table: "surface_revisions", owner: "author_user_id" },
    attach_calendar_event: { kind: "calendar_receipt", table: "calendar_event_receipts", owner: "attached_by_user_id" },
  };
  const effect = effects[operation];
  if (!effect || locator.kind !== effect.kind) throw new Error("effect_locator_not_verifiable");
  return { sql: `SELECT 1 FROM ${effect.table} effect WHERE effect.id=? AND effect.${effect.owner}=?`, values: [locator.id, actorUserId] };
}
