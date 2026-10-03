import { consumeWebRateLimit } from "../security/rate-limit";

export type BlockedBuilder = { userId: string; displayName: string; createdAt: number };

export async function listBlockedBuilders(DB: D1Database, actorId: string): Promise<BlockedBuilder[]> { return (await listBlockedBuildersPage(DB,actorId,null,200)).items; }

export async function listBlockedBuildersPage(DB: D1Database, actorId: string, after: string|null, limit=50): Promise<{items:BlockedBuilder[];nextCursor:string|null}> {
  const bounded=Math.max(1,Math.min(100,limit)),cursor=parseBlockedCursor(after);
  const rows=await DB.prepare(`SELECT b.blocked_user_id AS userId,COALESCE(p.display_name,'Builder') AS displayName,b.created_at AS createdAt
    FROM blocks b LEFT JOIN profiles p ON p.user_id=b.blocked_user_id
    WHERE b.blocker_user_id=? AND b.revoked_at IS NULL AND (b.created_at<? OR (b.created_at=? AND b.blocked_user_id<?))
    ORDER BY b.created_at DESC,b.blocked_user_id DESC LIMIT ?`).bind(actorId,cursor.at,cursor.at,cursor.id,bounded+1).all<BlockedBuilder>();
  const items=rows.results.slice(0,bounded);
  return {items,nextCursor:rows.results.length>bounded&&items.length?`b:${items[items.length-1]!.createdAt}:${encodeURIComponent(items[items.length-1]!.userId)}`:null};
}
function parseBlockedCursor(value:string|null){if(!value)return{at:Number.MAX_SAFE_INTEGER,id:"~"};if(!value.startsWith("b:"))throw new Error("invalid_blocked_cursor");const parts=value.split(":");const at=Number(parts[1]);if(!Number.isSafeInteger(at)||at<0||!parts[2])throw new Error("invalid_blocked_cursor");let id="";try{id=decodeURIComponent(parts.slice(2).join(":"))}catch{throw new Error("invalid_blocked_cursor")}if(!id)throw new Error("invalid_blocked_cursor");return{at,id}}

export async function blockBuilder(DB: D1Database, input: { actorId: string; targetUserId: string; now: number }) {
  await consumeWebRateLimit(DB, "block", input.actorId, 30, 60 * 60 * 1000, input.now);
  if (input.actorId === input.targetUserId) throw new Error("block_invalid");
  const target = await DB.prepare("SELECT 1 AS ok FROM users WHERE id=? AND status='active'").bind(input.targetUserId).first();
  if (!target) throw new Error("target_not_found");
  const a = input.actorId < input.targetUserId ? input.actorId : input.targetUserId;
  const b = input.actorId < input.targetUserId ? input.targetUserId : input.actorId;
  await DB.batch([
    DB.prepare("INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at,revoked_at) VALUES (?,?,?,NULL) ON CONFLICT(blocker_user_id,blocked_user_id) DO UPDATE SET created_at=excluded.created_at,revoked_at=NULL").bind(input.actorId,input.targetUserId,input.now),
    DB.prepare("DELETE FROM candidate_batches WHERE user_id IN (?,?)").bind(input.actorId,input.targetUserId),
    DB.prepare("DELETE FROM pair_scores WHERE user_a_id=? AND user_b_id=?").bind(a,b),
    DB.prepare("UPDATE match_proposals SET state='invalidated',terminal_at=? WHERE state='pending' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? AND user_b_id=?)").bind(input.now,a,b),
    DB.prepare("UPDATE connections SET state='blocked',ended_by_user_id=?,ended_at=?,updated_at=? WHERE state='active' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? AND user_b_id=?)").bind(input.actorId,input.now,input.now,a,b),
    DB.prepare("UPDATE rooms SET status='ended',updated_at=? WHERE status='active' AND match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id=? AND user_b_id=?)").bind(input.now,a,b),
  ]);
}

export async function unblockBuilder(DB: D1Database, input: { actorId: string; targetUserId: string; now: number }) {
  const result = await DB.prepare("UPDATE blocks SET revoked_at=? WHERE blocker_user_id=? AND blocked_user_id=? AND revoked_at IS NULL").bind(input.now,input.actorId,input.targetUserId).run();
  if (Number(result.meta?.changes ?? 0) !== 1) throw new Error("block_not_found");
}

export async function reportTarget(DB: D1Database, input: { actorId: string; targetKind: "user"|"profile"|"project"|"room"|"circle"|"message"; targetId: string; reasonCode: "spam"|"harassment"|"impersonation"|"unsafe_content"|"privacy"|"other"; details?: string; now: number }) {
  await consumeWebRateLimit(DB, "report", input.actorId, 10, 60 * 60 * 1000, input.now);
  if (!await mayReport(DB,input.actorId,input.targetKind,input.targetId)) throw new Error("target_not_found");
  const reportId=crypto.randomUUID(); const caseId=crypto.randomUUID();
  await DB.batch([
    DB.prepare("INSERT INTO reports (id,reporter_user_id,target_kind,target_id,reason_code,details,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'received',?,?)").bind(reportId,input.actorId,input.targetKind,input.targetId,input.reasonCode,input.details??null,input.now,input.now),
    DB.prepare("INSERT INTO moderation_cases (id,report_id,status,created_at,updated_at) VALUES (?,?,'open',?,?)").bind(caseId,reportId,input.now,input.now),
  ]);
  return { reportId };
}

async function mayReport(DB:D1Database,actorId:string,kind:string,targetId:string){
  if(kind==="user")return Boolean(await DB.prepare("SELECT 1 AS ok FROM users WHERE id=? AND status='active' AND id<>?").bind(targetId,actorId).first());
  if(kind==="profile")return Boolean(await DB.prepare("SELECT 1 AS ok FROM profiles WHERE id=? AND user_id<>? AND published_at IS NOT NULL").bind(targetId,actorId).first());
  if(kind==="project")return Boolean(await DB.prepare("SELECT 1 AS ok FROM projects WHERE id=? AND owner_user_id<>? AND audience='public' AND deleted_at IS NULL").bind(targetId,actorId).first());
  if(kind==="room")return Boolean(await DB.prepare("SELECT 1 AS ok FROM room_memberships WHERE room_id=? AND user_id=?").bind(targetId,actorId).first());
  if(kind==="circle")return Boolean(await DB.prepare("SELECT 1 AS ok FROM circle_memberships WHERE circle_id=? AND user_id=? AND status IN ('invited','accepted','active')").bind(targetId,actorId).first());
  if(kind==="message")return Boolean(await DB.prepare("SELECT 1 AS ok FROM messages m JOIN room_memberships rm ON rm.room_id=m.room_id AND rm.user_id=? WHERE m.id=?").bind(actorId,targetId).first());
  return false;
}
