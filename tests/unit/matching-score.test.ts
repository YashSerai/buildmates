import { describe, expect, it } from "vitest";
import { assertValidTaxonomy, builderFixture, canonicalizeBuilderTerms, matchingFixtureTaxonomy, normalizeTaxonomyText, retrieveCandidates } from "../../packages/matching/src";

const context = { userId: "alice", signedIn: true, suggestedUserIds: ["bob", "carol"], mutualUserIds: [], cohortIds: [] };

describe("deterministic matching", () => {
  it("normalizes vocabulary aliases to canonical topics", () => {
    expect(normalizeTaxonomyText("  Conversational—Voice AI! ")).toBe("conversational voice ai");
    expect(canonicalizeBuilderTerms({ taxonomy: matchingFixtureTaxonomy, topics: ["retrieval augmented generation", "RAG", "audio agents"] }).topics)
      .toEqual(["topic-rag", "topic-voice"]);
    expect(assertValidTaxonomy(matchingFixtureTaxonomy)).toBe(matchingFixtureTaxonomy);
  });

  it("ranks relevant and adjacent builders deterministically", () => {
    const viewer = builderFixture("alice");
    const relevant = builderFixture("bob", { evidence: [{ id: "signal-public", ownerUserId: "bob", audience: "public" }] });
    const adjacent = builderFixture("carol", { topics: ["topic-evals"], tools: [], evidence: [{ id: "signal-private", ownerUserId: "carol", audience: "private" }] });
    const unrelated = builderFixture("dana", { topics: ["topic-voice"], tools: [], domains: [], stages: ["stage-launch"], intents: ["intent-cofounder"], coarseLocation: "Berlin", timezoneOffsetMinutes: 120 });
    const result = retrieveCandidates({ viewer, candidates: [unrelated, adjacent, relevant], taxonomy: matchingFixtureTaxonomy, viewerContext: context, now: new Date(), relevanceFloor: 500 });
    expect(result.map((candidate) => candidate.userId)).toEqual(["bob", "carol", "dana"]);
    expect(result[0]?.explanation.visibleEvidenceIds).toEqual(["signal-public"]);
    expect(result[1]?.explanation.visibleEvidenceIds).toEqual([]);
    expect(result[1]?.explanation.hiddenEvidenceContributed).toBe(true);
  });

  it("fails closed for pauses, blocks, exclusions, stale taxonomy, expiry, and the top-30 cap", () => {
    const viewer = builderFixture("alice", { excludedUserIds: ["excluded"] });
    const candidates = Array.from({ length: 38 }, (_, index) => builderFixture(`candidate-${String(index).padStart(2, "0")}`));
    candidates.push(builderFixture("excluded"), builderFixture("stale", { taxonomyVersion: 2 }), builderFixture("expired", { expiresAt: new Date(0) }));
    const result = retrieveCandidates({ viewer, candidates, taxonomy: matchingFixtureTaxonomy, viewerContext: context, blockedPairs: new Set(["alice:candidate-00"]), now: new Date(), limit: 99 });
    expect(result).toHaveLength(30);
    expect(result.some(({ userId }) => ["excluded", "stale", "expired", "candidate-00"].includes(userId))).toBe(false);
    expect(retrieveCandidates({ viewer: { ...viewer, paused: true }, candidates, taxonomy: matchingFixtureTaxonomy, viewerContext: context, now: new Date() })).toEqual([]);
  });
});
