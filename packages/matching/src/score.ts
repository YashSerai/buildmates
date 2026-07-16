import type { ScoreFeatures } from "./features";

export const MATCH_WEIGHT_VERSION = 1;
export const MATCH_WEIGHTS: Readonly<Record<keyof ScoreFeatures, number>> = {
  topicOverlap: 2400, topicAdjacency: 1300, toolDomainFit: 900, stageFit: 650, intentFit: 1300,
  offerNeedFit: 350, locationFit: 550, timezoneFit: 350, cohortFit: 500, freshness: 500, confidence: 700,
  priorDeclinePenalty: -2600, clusterRepetitionPenalty: -900, serendipity: 500,
};

export type DeterministicScore = { weightVersion: number; totalBasisPoints: number; components: Record<keyof ScoreFeatures, number> };

export function scoreFeatures(features: ScoreFeatures): DeterministicScore {
  const components = {} as Record<keyof ScoreFeatures, number>;
  let total = 0;
  for (const key of Object.keys(MATCH_WEIGHTS) as (keyof ScoreFeatures)[]) {
    const contribution = Math.round(Math.max(0, Math.min(1, features[key])) * MATCH_WEIGHTS[key]);
    components[key] = contribution; total += contribution;
  }
  return { weightVersion: MATCH_WEIGHT_VERSION, totalBasisPoints: Math.max(0, Math.min(10_000, total)), components };
}
