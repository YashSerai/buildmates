import type { BuilderMatchIndex } from "./builder-index";
import type { MatchingTaxonomy } from "./taxonomy";

export type ScoreFeatures = {
  topicOverlap: number; topicAdjacency: number; toolDomainFit: number; stageFit: number; intentFit: number;
  offerNeedFit: number; locationFit: number; timezoneFit: number; cohortFit: number; freshness: number; confidence: number;
  priorDeclinePenalty: number; clusterRepetitionPenalty: number; serendipity: number;
};

const overlap = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a); const right = new Set(b); const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let shared = 0; for (const id of left) if (right.has(id)) shared += 1;
  return shared / union.size;
};
const anyOverlap = (a: readonly string[], b: readonly string[]) => a.some((value) => b.includes(value)) ? 1 : 0;

export function extractScoreFeatures(a: BuilderMatchIndex, b: BuilderMatchIndex, taxonomy: MatchingTaxonomy, repeatedClusters = 0): ScoreFeatures {
  const sharedTopics = overlap(a.topics, b.topics);
  let adjacency = 0;
  for (const relation of taxonomy.topicRelationships) {
    if ((a.topics.includes(relation.fromTopicId) && b.topics.includes(relation.toTopicId)) || (b.topics.includes(relation.fromTopicId) && a.topics.includes(relation.toTopicId))) {
      adjacency = Math.max(adjacency, relation.weightBasisPoints / 10_000);
    }
  }
  const stageOrdinals = new Map(taxonomy.stages.map((stage) => [stage.id, stage.ordinal]));
  const stageDistance = a.stages.flatMap((left) => b.stages.map((right) => Math.abs((stageOrdinals.get(left) ?? 0) - (stageOrdinals.get(right) ?? 0))));
  const stageFit = stageDistance.length ? Math.max(0, 1 - Math.min(...stageDistance) / 4) : 0;
  const tzDistance = a.timezoneOffsetMinutes === null || b.timezoneOffsetMinutes === null ? null : Math.abs(a.timezoneOffsetMinutes - b.timezoneOffsetMinutes);
  const prefersLocal = (100 - ((a.localGlobal + b.localGlobal) / 2)) / 100;
  const prefersAdjacent = ((a.similarAdjacent + b.similarAdjacent) / 2) / 100;
  const rawSerendipity = ((a.serendipity + b.serendipity) / 2) / 100;
  return {
    topicOverlap: sharedTopics * (1 - prefersAdjacent * .25),
    topicAdjacency: adjacency * (.5 + prefersAdjacent * .5),
    toolDomainFit: Math.max(overlap(a.tools, b.tools), overlap(a.domains, b.domains)),
    stageFit,
    intentFit: overlap(a.intents, b.intents),
    offerNeedFit: Math.max(anyOverlap(a.offers, b.needs), anyOverlap(b.offers, a.needs)),
    locationFit: a.coarseLocation && b.coarseLocation && a.coarseLocation === b.coarseLocation ? .5 + prefersLocal * .5 : 0,
    timezoneFit: tzDistance === null ? .35 : Math.max(0, 1 - tzDistance / 720),
    cohortFit: anyOverlap(a.cohortIds, b.cohortIds),
    freshness: Math.min(a.freshness, b.freshness) / 100,
    confidence: Math.min(a.confidence, b.confidence) / 100,
    priorDeclinePenalty: a.declineUserIds.includes(b.userId) || b.declineUserIds.includes(a.userId) ? 1 : 0,
    clusterRepetitionPenalty: Math.min(1, repeatedClusters / 3),
    serendipity: rawSerendipity * (1 - Math.max(sharedTopics, adjacency)) * Math.min(a.confidence, b.confidence) / 100,
  };
}
