import { isIndexCurrent, type BuilderMatchIndex } from "./builder-index";
import { explainScore, type ViewerContext } from "./explain";
import { extractScoreFeatures } from "./features";
import { scoreFeatures, type DeterministicScore } from "./score";
import type { MatchingTaxonomy } from "./taxonomy";

export type CandidateResult = { userId: string; indexVersion: number; score: DeterministicScore; explanation: ReturnType<typeof explainScore> };
export function retrieveCandidates(input: { viewer: BuilderMatchIndex; candidates: readonly BuilderMatchIndex[]; taxonomy: MatchingTaxonomy; viewerContext: ViewerContext; blockedPairs?: ReadonlySet<string>; repeatedClusterCounts?: ReadonlyMap<string, number>; now: Date; limit?: number; relevanceFloor?: number }): CandidateResult[] {
  const limit = Math.max(1, Math.min(30, input.limit ?? 30)); const floor = input.relevanceFloor ?? 1_500;
  if (!isIndexCurrent(input.viewer, input.now)) return [];
  const results: CandidateResult[] = [];
  for (const candidate of input.candidates) {
    if (candidate.userId === input.viewer.userId || candidate.taxonomyVersion !== input.viewer.taxonomyVersion || !isIndexCurrent(candidate, input.now)) continue;
    if (input.viewer.excludedUserIds.includes(candidate.userId) || candidate.excludedUserIds.includes(input.viewer.userId)) continue;
    const pairKey = [input.viewer.userId, candidate.userId].sort().join(":"); if (input.blockedPairs?.has(pairKey)) continue;
    if (input.viewer.excludedKeys.some((key) => candidate.excludedKeys.includes(key))) continue;
    const repeated = candidate.clusterIds.reduce((sum, cluster) => sum + (input.repeatedClusterCounts?.get(cluster) ?? 0), 0);
    const score = scoreFeatures(extractScoreFeatures(input.viewer, candidate, input.taxonomy, repeated));
    if (score.totalBasisPoints < floor) continue;
    results.push({ userId: candidate.userId, indexVersion: candidate.version, score, explanation: explainScore(input.viewerContext, candidate, score) });
  }
  return results.sort((a, b) => b.score.totalBasisPoints - a.score.totalBasisPoints || a.userId.localeCompare(b.userId)).slice(0, limit);
}
