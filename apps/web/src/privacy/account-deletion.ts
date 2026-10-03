import type { D1Like } from "../platform/d1";
import type { R2Like } from "../platform/r2";

type DB = D1Database & D1Like;
type IdempotencyLease = { operation: string; key: string };
type HashedIdempotencyLease = { operation: string; keyHash: string };

export type AccountDeletionResult = { jobId: string; status: "deleting" | "complete" };

// R2 deletion is deliberately resumable. A historical account can have more
// objects than the current upload quota, and one Worker invocation must not
// turn that cleanup into an all-or-nothing request.
const ASSET_PURGE_BATCH_SIZE = 100;

export async function beginAccountDeletion(DB: DB, userId: string, assets?: R2Like, lease?: IdempotencyLease): Promise<AccountDeletionResult> {
  const now = Date.now();
  const hashedLease = lease ? { operation: lease.operation, keyHash: await hashIdempotencyKey(lease.key) } : undefined;
  const ownedAsset = await DB.prepare("SELECT id FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NULL LIMIT 1").bind(userId).first<{ id: string }>();
  if (ownedAsset && !assets) throw new Error("account_assets_unavailable");
  const jobId = `deletion_${crypto.randomUUID()}`;
  const results = await DB.batch([
    DB.prepare("INSERT INTO deletion_jobs (id,user_id,status,requested_at,updated_at) SELECT ?,?,'deleting',?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND status='active')").bind(jobId,userId,now,now,userId),
    // D1 executes every statement in a batch even when the conditional job
    // insert affects zero rows. Make a lost active-user claim a constraint
    // failure so the whole batch rolls back before any redaction can commit.
    DB.prepare("INSERT INTO deletion_jobs (id,user_id,status,requested_at,updated_at) SELECT NULL,?,'deleting',?,? WHERE NOT EXISTS (SELECT 1 FROM users WHERE id=? AND status='active')").bind(userId,now,now,userId),
    DB.prepare("UPDATE connected_app_preferences SET access_mode='never',revoked_at=COALESCE(revoked_at,?),last_reviewed_at=? WHERE user_id=?").bind(now,now,userId),
    DB.prepare("UPDATE work_signals SET free_text_summary='',canonical_topic_ids_json='[]',canonical_tool_ids_json='[]',canonical_domain_ids_json='[]',canonical_stage_ids_json='[]',canonical_collaboration_intent_ids_json='[]',allow_matching=0,audience='private',revoked_at=COALESCE(revoked_at,?),updated_at=? WHERE user_id=?").bind(now,now,userId),
    DB.prepare("DELETE FROM source_use_approvals WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM builder_match_index WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM profile_topic_contributions WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM candidate_batches WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM pair_scores WHERE user_a_id=? OR user_b_id=?").bind(userId,userId),
    DB.prepare("DELETE FROM codex_evaluations WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM human_responses WHERE user_id=?").bind(userId),
    DB.prepare("UPDATE match_proposals SET explanation_a_json=CASE WHEN pair.user_a_id=? THEN '{}' ELSE explanation_a_json END,explanation_b_json=CASE WHEN pair.user_b_id=? THEN '{}' ELSE explanation_b_json END,shared_explanation_json=CASE WHEN pair.user_a_id=? OR pair.user_b_id=? THEN NULL ELSE shared_explanation_json END FROM match_pairs pair WHERE pair.id=match_proposals.match_pair_id AND (pair.user_a_id=? OR pair.user_b_id=?)").bind(userId,userId,userId,userId,userId,userId),
    DB.prepare("UPDATE match_proposals SET state='invalidated',terminal_at=? WHERE state='pending' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?)").bind(now,userId,userId),
    DB.prepare("UPDATE connections SET state='ended',ended_by_user_id=?,ended_at=?,updated_at=? WHERE state='active' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?)").bind(userId,now,now,userId,userId),
    DB.prepare("UPDATE reconnect_requests SET response='declined',responded_at=? WHERE response='pending' AND connection_id IN (SELECT connection.id FROM connections connection JOIN match_pairs pair ON pair.id=connection.match_pair_id WHERE pair.user_a_id=? OR pair.user_b_id=?)").bind(now,userId,userId),
    DB.prepare("UPDATE rooms SET status='ended',updated_at=? WHERE status='active' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? OR user_b_id=?)").bind(now,userId,userId),
    DB.prepare("UPDATE room_memberships SET left_at=COALESCE(left_at,?) WHERE user_id=?").bind(now,userId),
    DB.prepare("UPDATE messages SET body='[deleted by author]',deleted_at=COALESCE(deleted_at,?) WHERE sender_user_id=?").bind(now,userId),
    DB.prepare("UPDATE circle_messages SET body='[deleted by author]',deleted_at=COALESCE(deleted_at,?) WHERE sender_user_id=?").bind(now,userId),
    DB.prepare("UPDATE room_upgrade_proposals SET modules_json='[]',explanation='' WHERE proposer_user_id=?").bind(userId),
    DB.prepare("UPDATE room_module_entries SET payload_json='{}',updated_at=?,deleted_at=COALESCE(deleted_at,?) WHERE author_user_id=?").bind(now,now,userId),
    DB.prepare("UPDATE circle_proposals SET payload_json='{}' WHERE proposer_user_id=?").bind(userId),
    DB.prepare("UPDATE circle_module_entries SET payload_json='{}',updated_at=?,deleted_at=COALESCE(deleted_at,?) WHERE author_user_id=?").bind(now,now,userId),
    DB.prepare("UPDATE circle_metric_entries SET evidence=NULL WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM connection_private_notes WHERE owner_user_id=?").bind(userId),
    DB.prepare("DELETE FROM connection_reminders WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM connection_update_subscriptions WHERE subscriber_user_id=? OR subject_user_id=?").bind(userId,userId),
    DB.prepare("DELETE FROM introduction_feedback WHERE user_id=?").bind(userId),
    DB.prepare("UPDATE connection_snapshots SET display_name='Deleted builder',summary='' WHERE subject_user_id=?").bind(userId),
    DB.prepare("DELETE FROM connection_context_snapshots WHERE connection_id IN (SELECT connection.id FROM connections connection JOIN match_pairs pair ON pair.id=connection.match_pair_id WHERE pair.user_a_id=? OR pair.user_b_id=?)").bind(userId,userId),
    DB.prepare("DELETE FROM project_links WHERE project_id IN (SELECT id FROM projects WHERE owner_user_id=?)").bind(userId),
    DB.prepare("DELETE FROM project_media WHERE project_id IN (SELECT id FROM projects WHERE owner_user_id=?)").bind(userId),
    DB.prepare("DELETE FROM project_taxonomy_items WHERE project_id IN (SELECT id FROM projects WHERE owner_user_id=?)").bind(userId),
    DB.prepare("UPDATE projects SET title='Deleted project',summary='',audience='private',allow_matching=0,indexable=0,status='deleted',published_at=NULL,deleted_at=COALESCE(deleted_at,?),updated_at=? WHERE owner_user_id=?").bind(now,now,userId),
    DB.prepare("UPDATE project_updates SET body='[deleted by author]',edited_at=? WHERE author_user_id=?").bind(now,userId),
    DB.prepare("DELETE FROM project_collaborators WHERE user_id=? OR project_id IN (SELECT id FROM projects WHERE owner_user_id=?)").bind(userId,userId),
    DB.prepare("UPDATE profiles SET display_name='Deleted builder',summary='',project_or_interest='',portfolio_links_json='[]',audience='private',allow_matching=0,acceptance_mode='manual',indexable=0,coarse_location=NULL,location_map_opt_in=0,timezone=NULL,published_at=NULL,updated_at=? WHERE user_id=?").bind(now,userId),
    DB.prepare("DELETE FROM profile_project_media WHERE profile_id IN (SELECT id FROM profiles WHERE user_id=?)").bind(userId),
    DB.prepare("DELETE FROM surface_asset_upload_grants WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM profile_fields WHERE profile_id IN (SELECT id FROM profiles WHERE user_id=?)").bind(userId),
    DB.prepare("DELETE FROM profile_statistics WHERE profile_id IN (SELECT id FROM profiles WHERE user_id=?)").bind(userId),
    DB.prepare("DELETE FROM handles WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM calendar_event_receipts WHERE room_id IN (SELECT room_id FROM room_memberships WHERE user_id=?)").bind(userId),
    DB.prepare("DELETE FROM availability_windows WHERE room_id IN (SELECT room_id FROM room_memberships WHERE user_id=?)").bind(userId),
    DB.prepare("DELETE FROM meeting_proposals WHERE room_id IN (SELECT room_id FROM room_memberships WHERE user_id=?)").bind(userId),
    DB.prepare("DELETE FROM surface_approvals WHERE revision_id IN (SELECT revision.id FROM surface_revisions revision JOIN surfaces surface ON surface.id=revision.surface_id WHERE surface.owner_user_id=?)").bind(userId),
    DB.prepare("DELETE FROM personal_surface_views WHERE user_id=? OR revision_id IN (SELECT revision.id FROM surface_revisions revision JOIN surfaces surface ON surface.id=revision.surface_id WHERE surface.owner_user_id=?)").bind(userId,userId),
    DB.prepare("DELETE FROM surface_asset_attachments WHERE attached_by_user_id=? OR surface_id IN (SELECT id FROM surfaces WHERE owner_user_id=?)").bind(userId,userId),
    DB.prepare("UPDATE surfaces SET published_revision_id=NULL WHERE owner_user_id=?").bind(userId),
    DB.prepare("DELETE FROM surface_revisions WHERE surface_id IN (SELECT id FROM surfaces WHERE owner_user_id=?)").bind(userId),
    DB.prepare("DELETE FROM surfaces WHERE owner_user_id=?").bind(userId),
    DB.prepare("UPDATE invite_links SET revoked_at=COALESCE(revoked_at,?) WHERE creator_user_id=? OR recipient_user_id=?").bind(now,userId,userId),
    DB.prepare("DELETE FROM invite_redemptions WHERE user_id=?").bind(userId),
    DB.prepare("UPDATE cohort_memberships SET status='left' WHERE user_id=? AND status IN ('requested','invited','active')").bind(userId),
    DB.prepare("UPDATE cohorts SET status='archived',updated_at=? WHERE id IN (SELECT cohort_id FROM cohort_memberships WHERE user_id=? AND role='owner') AND status='active'").bind(now,userId),
    DB.prepare("UPDATE circle_memberships SET status='left' WHERE user_id=? AND status IN ('invited','accepted','active')").bind(userId),
    DB.prepare("UPDATE circles SET name='Deleted Circle',purpose='',status='archived',updated_at=? WHERE id IN (SELECT circle_id FROM circle_memberships WHERE user_id=? AND role='owner') AND status IN ('active','proposed','archived')").bind(now,userId),
    DB.prepare("DELETE FROM follows WHERE follower_user_id=? OR (target_kind='profile' AND target_id=?) OR (target_kind='project' AND target_id IN (SELECT id FROM projects WHERE owner_user_id=?))").bind(userId,userId,userId),
    DB.prepare("DELETE FROM watches WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM networking_pulses WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM introduction_budgets WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM quiet_hours WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM matching_snoozes WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM matching_exclusions WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM notifications WHERE user_id=? OR (json_valid(payload_json) AND (json_extract(payload_json,'$.candidateUserId')=? OR json_extract(payload_json,'$.userId')=? OR json_extract(payload_json,'$.senderUserId')=? OR json_extract(payload_json,'$.targetUserId')=? OR json_extract(payload_json,'$.roomId') IN (SELECT room_id FROM room_memberships WHERE user_id=?) OR json_extract(payload_json,'$.circleId') IN (SELECT circle_id FROM circle_memberships WHERE user_id=?) OR json_extract(payload_json,'$.connectionId') IN (SELECT connection_id FROM connection_sides WHERE user_id=?) OR json_extract(payload_json,'$.projectId') IN (SELECT id FROM projects WHERE owner_user_id=? OR id IN (SELECT project_id FROM project_updates WHERE author_user_id=?))))").bind(userId,userId,userId,userId,userId,userId,userId,userId,userId,userId),
    DB.prepare("DELETE FROM automation_checkpoints WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM setup_states WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM identity_link_codes WHERE user_id=?").bind(userId),
    DB.prepare("DELETE FROM web_sessions WHERE user_id=?").bind(userId),
    DB.prepare("UPDATE identity_principals SET subject='deleted:'||id,revoked_at=COALESCE(revoked_at,?) WHERE id IN (SELECT principal_id FROM identity_links WHERE user_id=?)").bind(now,userId),
    DB.prepare("UPDATE identity_links SET provider_subject='deleted:'||id,revoked_at=COALESCE(revoked_at,?) WHERE user_id=?").bind(now,userId),
    // Keep only the outer deletion lease when the MCP wrapper supplies its
    // operation and key. Direct web deletion has no outer lease, so all
    // replay rows are removed before the account is finalized.
    idempotencyCleanup(DB, userId, hashedLease),
    DB.prepare("UPDATE audit_events SET object_id='deleted',metadata_json='{}',idempotency_key=NULL WHERE actor_user_id=?").bind(userId),
    DB.prepare("UPDATE reports SET details=NULL,updated_at=? WHERE reporter_user_id=?").bind(now,userId),
    DB.prepare("UPDATE moderation_appeals SET statement='[retained appeal redacted after account deletion]' WHERE appellant_user_id=?").bind(userId),
    DB.prepare("DELETE FROM surface_asset_blobs WHERE asset_id IN (SELECT id FROM surface_assets WHERE owner_user_id=?)").bind(userId),
    DB.prepare("UPDATE surface_assets SET deleted_at=COALESCE(deleted_at,?),object_purged_at=NULL WHERE owner_user_id=?").bind(now,userId),
    DB.prepare("UPDATE users SET status='deleting',operator_role='none',deleted_at=?,updated_at=? WHERE id=? AND status='active'").bind(now,now,userId),
  ]).catch(() => { throw new Error("account_deletion_conflict"); });
  if (Number(results[0]?.meta.changes ?? 0) !== 1 || results.some((result) => !result.success)) throw new Error("account_deletion_conflict");
  return resumeAccountDeletion(DB, assets, jobId);
}

function idempotencyCleanup(DB: DB, userId: string, lease?: HashedIdempotencyLease) {
  if (!lease) return DB.prepare("DELETE FROM idempotency_keys WHERE actor_user_id=?").bind(userId);
  return DB.prepare("DELETE FROM idempotency_keys WHERE actor_user_id=? AND NOT (operation=? AND key_hash=?)").bind(userId, lease.operation, lease.keyHash);
}

export async function hashIdempotencyKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resumeAccountDeletion(DB: DB, assets: R2Like | undefined, jobId: string): Promise<AccountDeletionResult> {
  const row = await DB.prepare("SELECT job.user_id AS userId,job.status,user.status AS userStatus FROM deletion_jobs job JOIN users user ON user.id=job.user_id WHERE job.id=? LIMIT 1").bind(jobId).first<{userId:string;status:string;userStatus:string}>();
  if (!row) throw new Error("deletion_job_not_found");
  if (row.status === "complete" && row.userStatus === "deleted") return { jobId, status: "complete" };
  if (row.status !== "deleting" || row.userStatus !== "deleting") throw new Error("deletion_job_not_recoverable");
  const pending = await DB.prepare("SELECT id,object_key AS objectKey FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NOT NULL AND object_purged_at IS NULL ORDER BY object_key LIMIT ?").bind(row.userId, ASSET_PURGE_BATCH_SIZE).all<{id:string;objectKey:string}>();
  if (pending.results.length > 0) {
    if (!assets) return { jobId, status: "deleting" };
    try {
      for (let offset = 0; offset < pending.results.length; offset += 20) {
        await Promise.all(pending.results.slice(offset, offset + 20).map((asset) => assets.delete(asset.objectKey)));
      }
    } catch {
      return { jobId, status: "deleting" };
    }
    const placeholders = pending.results.map(() => "?").join(",");
    const purgedAt = Date.now();
    await DB.batch([
      DB.prepare(`DELETE FROM surface_asset_blobs WHERE asset_id IN (${placeholders})`).bind(...pending.results.map((asset) => asset.id)),
      DB.prepare(`UPDATE surface_assets SET object_purged_at=deleted_at WHERE object_purged_at IS NULL AND id IN (${placeholders})`).bind(...pending.results.map((asset) => asset.id)),
      DB.prepare("UPDATE deletion_jobs SET updated_at=? WHERE id=? AND user_id=? AND status='deleting'").bind(purgedAt,jobId,row.userId),
    ]);
    const remaining = await DB.prepare("SELECT id FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NOT NULL AND object_purged_at IS NULL LIMIT 1").bind(row.userId).first<{ id: string }>();
    if (remaining) return { jobId, status: "deleting" };
  }

  const completedAt = Date.now();
  await DB.batch([
    DB.prepare("UPDATE users SET status='deleted',updated_at=? WHERE id=? AND status='deleting' AND EXISTS (SELECT 1 FROM deletion_jobs WHERE id=? AND user_id=? AND status='deleting') AND NOT EXISTS (SELECT 1 FROM surface_assets WHERE owner_user_id=? AND deleted_at IS NOT NULL AND object_purged_at IS NULL)").bind(completedAt,row.userId,jobId,row.userId,row.userId),
    DB.prepare("UPDATE deletion_jobs SET status='complete',completed_at=?,updated_at=? WHERE id=? AND user_id=? AND status='deleting' AND EXISTS (SELECT 1 FROM users WHERE id=? AND status='deleted')").bind(completedAt,completedAt,jobId,row.userId,row.userId),
    DB.prepare("INSERT OR IGNORE INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) SELECT ?,?,'deletion.completed','deletion_job',?,'{}',? WHERE EXISTS (SELECT 1 FROM deletion_jobs WHERE id=? AND user_id=? AND status='complete')").bind(`deletion.complete:${jobId}`,row.userId,jobId,completedAt,jobId,row.userId),
  ]);
  const completed = await DB.prepare("SELECT job.status,user.status AS userStatus FROM deletion_jobs job JOIN users user ON user.id=job.user_id WHERE job.id=? LIMIT 1").bind(jobId).first<{status:string;userStatus:string}>();
  return completed?.status === "complete" && completed.userStatus === "deleted" ? { jobId, status: "complete" } : { jobId, status: "deleting" };
}
