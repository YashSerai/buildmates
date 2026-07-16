import type { BuilderMatchIndex, IndexedEvidence } from "./builder-index";
import type { DeterministicScore } from "./score";

export type ViewerContext = { userId: string; signedIn: boolean; suggestedUserIds: readonly string[]; mutualUserIds: readonly string[]; cohortIds: readonly string[] };
export function canViewerSeeEvidence(evidence: IndexedEvidence, viewer: ViewerContext): boolean {
  if (evidence.ownerUserId === viewer.userId || evidence.audience === "public") return true;
  if (!viewer.signedIn || evidence.audience === "private") return false;
  if (evidence.cohortScopeId && !viewer.cohortIds.includes(evidence.cohortScopeId)) return false;
  if (evidence.audience === "signed_in") return true;
  if (evidence.audience === "suggested_connections") return viewer.suggestedUserIds.includes(evidence.ownerUserId);
  return viewer.mutualUserIds.includes(evidence.ownerUserId);
}

export function explainScore(viewer: ViewerContext, candidate: BuilderMatchIndex, score: DeterministicScore) {
  const visibleEvidenceIds = candidate.evidence.filter((evidence) => canViewerSeeEvidence(evidence, viewer)).map((evidence) => evidence.id);
  const hiddenEvidenceContributed = candidate.evidence.length > visibleEvidenceIds.length;
  const ranked = hiddenEvidenceContributed ? [] : Object.entries(score.components).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => key);
  return { reasonCodes: ranked.length ? ranked : ["mutual_relevance"], visibleEvidenceIds, hiddenEvidenceContributed };
}
