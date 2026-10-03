import { evaluateCandidate, listCandidateRows, respondToProposal, saveCandidateBatch, type CandidateRow } from "./service";
import { consumeWebRateLimit, WebRateLimitError } from "../security/rate-limit";

type D1 = D1Database;

export type McpCandidate = CandidateRow & { proposalId: string | null };

export async function getMcpCandidateShortlist(DB: D1, input: { userId: string; batchId?: string; limit: number; now: string }) {
  const now = parseNow(input.now);
  try {
    await consumeWebRateLimit(DB, "candidate_shortlist", input.userId, 12, 10 * 60 * 1000, now);
  } catch (error) {
    if (error instanceof WebRateLimitError) throw new Error("candidate_rate_limited");
    throw error;
  }
  const limit = Math.max(1, Math.min(30, input.limit));
  let batchId = input.batchId ?? null;
  let expiresAt: number | null = null;
  let candidates: CandidateRow[];

  if (batchId) {
    const batch = await DB.prepare(`SELECT cb.candidate_ids_json AS candidateIdsJson,cb.expires_at AS expiresAt
      FROM candidate_batches cb
      JOIN builder_match_index self ON self.user_id=cb.user_id AND self.version=cb.index_version
      JOIN taxonomy_versions taxonomy ON taxonomy.id=self.taxonomy_version_id AND taxonomy.version=cb.taxonomy_version AND taxonomy.status='active'
      WHERE cb.id=? AND cb.user_id=? AND cb.expires_at>? LIMIT 1`)
      .bind(batchId, input.userId, now).first<{ candidateIdsJson: string; expiresAt: number }>();
    if (!batch) throw new Error("candidate_batch_invalid");
    const candidateIds = parseIds(batch.candidateIdsJson).slice(0, limit);
    const current = await listCandidateRows(DB, input.userId, now, 30);
    const byId = new Map(current.map((candidate) => [candidate.userId, candidate]));
    candidates = candidateIds.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
    expiresAt = batch.expiresAt;
  } else {
    candidates = await listCandidateRows(DB, input.userId, now, limit);
    batchId = await saveCandidateBatch(DB, input.userId, candidates, now);
    if (batchId) {
      const batch = await DB.prepare("SELECT expires_at AS expiresAt FROM candidate_batches WHERE id=? AND user_id=? LIMIT 1")
        .bind(batchId, input.userId).first<{ expiresAt: number }>();
      expiresAt = batch?.expiresAt ?? null;
    }
  }

  const proposals = await pendingProposalIds(DB, input.userId, candidates.map((candidate) => candidate.userId), now);
  return {
    batchId,
    expiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString(),
    candidates: candidates.map((candidate): McpCandidate => ({ ...candidate, proposalId: proposals.get(candidate.userId) ?? null })),
  };
}

export async function recordMcpCandidateEvaluation(DB: D1, input: { userId: string; evaluationId: string; batchId: string; candidateUserId: string; decision: "approve" | "decline" | "defer"; reasonSummary: string; evidenceIds: string[]; indexVersion: number; now: string }) {
  return evaluateCandidate(DB, {
    actorId: input.userId,
    evaluationId: input.evaluationId,
    batchId: input.batchId,
    candidateUserId: input.candidateUserId,
    decision: input.decision,
    reasonSummary: input.reasonSummary,
    evidenceIds: input.evidenceIds,
    indexVersion: input.indexVersion,
    now: parseNow(input.now),
  });
}

export async function recordMcpManualMatchResponse(DB: D1, input: { userId: string; responseId: string; proposalId: string; response: "interested" | "decline"; now: string }) {
  return respondToProposal(DB, {
    actorId: input.userId,
    responseId: input.responseId,
    proposalId: input.proposalId,
    response: input.response,
    now: parseNow(input.now),
  });
}

async function pendingProposalIds(DB: D1, viewerId: string, candidateIds: string[], now: number) {
  const ids = [...new Set(candidateIds)].slice(0, 30);
  if (ids.length === 0) return new Map<string, string>();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await DB.prepare(`SELECT p.id AS proposalId,
      CASE WHEN mp.user_a_id=? THEN mp.user_b_id ELSE mp.user_a_id END AS candidateUserId
    FROM match_proposals p JOIN match_pairs mp ON mp.id=p.match_pair_id
    WHERE p.state='pending' AND p.expires_at>? AND
      ((mp.user_a_id=? AND mp.user_b_id IN (${placeholders})) OR (mp.user_b_id=? AND mp.user_a_id IN (${placeholders})))`)
    .bind(viewerId, now, viewerId, ...ids, viewerId, ...ids)
    .all<{ proposalId: string; candidateUserId: string }>();
  return new Map(rows.results.map((row) => [row.candidateUserId, row.proposalId]));
}

function parseIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    throw new Error("candidate_batch_invalid");
  }
}

function parseNow(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid_timestamp");
  return parsed;
}
