import type { BuilderMatchIndex } from "./builder-index";
import type { MatchingTaxonomy } from "./taxonomy";

export const matchingFixtureTaxonomy: MatchingTaxonomy = {
  id: "taxonomy-v1", version: 1,
  topics: [{ id: "topic-rag", slug: "rag", label: "Retrieval-augmented generation", aliases: ["retrieval augmented generation", "retrieval systems"] }, { id: "topic-voice", slug: "voice-agents", label: "Voice agents", aliases: ["conversational voice ai", "audio agents"] }, { id: "topic-evals", slug: "evals", label: "AI evaluation" }],
  tools: [{ id: "tool-pgvector", slug: "pgvector", label: "pgvector" }], domains: [{ id: "domain-devtools", slug: "developer-tools", label: "Developer tools" }],
  stages: [{ id: "stage-prototype", slug: "prototype", label: "Prototype", ordinal: 1 }, { id: "stage-launch", slug: "launch", label: "Launch", ordinal: 2 }],
  collaborationIntents: [{ id: "intent-peers", slug: "meet-peers", label: "Meet peers" }, { id: "intent-cofounder", slug: "cofounder", label: "Explore cofounding" }],
  topicRelationships: [{ fromTopicId: "topic-rag", toTopicId: "topic-evals", kind: "related", weightBasisPoints: 7200 }],
};

export const builderFixture = (userId: string, overrides: Partial<BuilderMatchIndex> = {}): BuilderMatchIndex => ({
  userId, version: 1, taxonomyVersion: 1, topics: ["topic-rag"], tools: ["tool-pgvector"], domains: ["domain-devtools"], stages: ["stage-prototype"], intents: ["intent-peers"], offers: [], needs: [], cohortIds: [], clusterIds: [], coarseLocation: "Vancouver", timezoneOffsetMinutes: -420, similarAdjacent: 50, localGlobal: 50, serendipity: 25, freshness: 90, confidence: 90, paused: false, expiresAt: null, excludedUserIds: [], excludedKeys: [], declineUserIds: [], evidence: [], ...overrides,
});

export const labeledMatchingFixtures = [
  { label: "strong-overlap", expected: "relevant", a: builderFixture("overlap-a"), b: builderFixture("overlap-b") },
  { label: "taxonomy-adjacent", expected: "relevant", a: builderFixture("adjacent-a"), b: builderFixture("adjacent-b", { topics: ["topic-evals"], tools: [] }) },
  { label: "borderline-serendipity", expected: "borderline", a: builderFixture("border-a", { serendipity: 80 }), b: builderFixture("border-b", { topics: ["topic-voice"], tools: [], domains: [], intents: ["intent-cofounder"], coarseLocation: "Berlin", serendipity: 80 }) },
  { label: "blocked", expected: "ineligible", a: builderFixture("blocked-a"), b: builderFixture("blocked-b") },
  { label: "explicit-exclusion", expected: "ineligible", a: builderFixture("excluded-a", { excludedUserIds: ["excluded-b"] }), b: builderFixture("excluded-b") },
] as const;
