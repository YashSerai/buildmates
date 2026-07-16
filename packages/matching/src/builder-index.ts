export type EvidenceAudience = "public" | "signed_in" | "suggested_connections" | "mutual_connections" | "private";
export type IndexedEvidence = { id: string; ownerUserId: string; audience: EvidenceAudience; cohortScopeId?: string | null };

export type BuilderMatchIndex = {
  userId: string;
  version: number;
  taxonomyVersion: number;
  topics: readonly string[];
  tools: readonly string[];
  domains: readonly string[];
  stages: readonly string[];
  intents: readonly string[];
  offers: readonly string[];
  needs: readonly string[];
  cohortIds: readonly string[];
  clusterIds: readonly string[];
  coarseLocation: string | null;
  timezoneOffsetMinutes: number | null;
  similarAdjacent: number;
  localGlobal: number;
  serendipity: number;
  freshness: number;
  confidence: number;
  paused: boolean;
  expiresAt: Date | null;
  excludedUserIds: readonly string[];
  excludedKeys: readonly string[];
  declineUserIds: readonly string[];
  evidence: readonly IndexedEvidence[];
};

export function buildBuilderIndex(input: BuilderMatchIndex): BuilderMatchIndex {
  if (!input.userId || !Number.isSafeInteger(input.version) || input.version < 1) throw new Error("builder_index_invalid");
  if (!Number.isSafeInteger(input.taxonomyVersion) || input.taxonomyVersion < 1) throw new Error("builder_index_taxonomy_invalid");
  for (const value of [input.similarAdjacent, input.localGlobal, input.serendipity, input.freshness, input.confidence]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("builder_index_preference_invalid");
  }
  const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))].sort();
  return {
    ...input,
    topics: unique(input.topics), tools: unique(input.tools), domains: unique(input.domains), stages: unique(input.stages),
    intents: unique(input.intents), offers: unique(input.offers), needs: unique(input.needs), cohortIds: unique(input.cohortIds),
    clusterIds: unique(input.clusterIds), excludedUserIds: unique(input.excludedUserIds), excludedKeys: unique(input.excludedKeys),
    declineUserIds: unique(input.declineUserIds), evidence: [...input.evidence].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function isIndexCurrent(index: BuilderMatchIndex, now: Date): boolean {
  return !index.paused && (!index.expiresAt || index.expiresAt.getTime() > now.getTime());
}

export const MATERIAL_INDEX_EVENTS = ["work_signal_changed", "profile_changed", "project_changed", "cohort_changed", "networking_pulse_changed", "source_revoked", "signal_expired", "visibility_changed", "matching_paused", "block_changed"] as const;
export type MaterialIndexEvent = typeof MATERIAL_INDEX_EVENTS[number];
export function planIndexRebuild(userId: string, currentVersion: number, event: MaterialIndexEvent) {
  if (!MATERIAL_INDEX_EVENTS.includes(event)) throw new Error("index_event_invalid");
  return { userId, nextVersion: currentVersion + 1, invalidatePairScoresForUserId: userId, invalidateUnopenedProposals: event === "source_revoked" || event === "signal_expired" || event === "visibility_changed" || event === "matching_paused" || event === "block_changed" };
}
