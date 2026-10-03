export type McpRecord<T = unknown> = {
  kind: string;
  id: string;
  ownerUserId: string;
  memberUserIds: string[];
  value: T;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type McpRecordWrite<T = unknown> = {
  kind: string;
  id: string;
  ownerUserId: string;
  actorUserId?: string;
  memberUserIds?: string[];
  value: T;
  expectedVersion?: number | null;
  now: string;
};

export type IdempotentMutation<T> = {
  actorUserId: string;
  operation: string;
  key: string;
  requestHash: string;
  now: string;
  preserveLeaseOnError?: boolean;
  execute(): Promise<T>;
};

export type McpPageOptions = { cursor?: string; limit: number; filter?: { connectionId?: string; surfaceId?: string } };
export type McpRecordPage<T = unknown> = { records: McpRecord<T>[]; nextCursor: string | null };

export interface McpProductRepository {
  readForMember<T>(kind: string, id: string, actorUserId: string): Promise<McpRecord<T> | null>;
  listForMember<T>(kind: string, actorUserId: string): Promise<McpRecord<T>[]>;
  listPageForMember<T>(kind: string, actorUserId: string, options: McpPageOptions): Promise<McpRecordPage<T>>;
  write<T>(input: McpRecordWrite<T>): Promise<McpRecord<T>>;
  deleteForOwner(kind: string, id: string, actorUserId: string): Promise<boolean>;
  runIdempotent<T>(input: IdempotentMutation<T>): Promise<{ replayed: boolean; value: T }>;
}

export function canonicalFollowWatchId(relation: string, targetKind: string, targetId: string) {
  return `${relation}:${targetKind}:${targetId}`;
}

export function createMemoryMcpProductRepository(): McpProductRepository {
  const records = new Map<string, McpRecord>();
  const idempotency = new Map<string, { requestHash: string; promise: Promise<unknown>; uncertain?: boolean }>();
  const sourceApprovals = new Map<string, { ownerUserId: string; sourceId: string; expiresAt: number; consumed: boolean }>();
  const key = (kind: string, owner: string, id: string) => `${kind}\u0000${owner}\u0000${id}`;
  const clone = <T>(value: T): T => structuredClone(value);

  const findAuthorized = (kind: string, id: string, actor: string) => [...records.values()].find((record) => record.kind === kind && record.id === id && (record.ownerUserId === actor || record.memberUserIds.includes(actor)));

  return {
    async readForMember<T>(kind: string, id: string, actorUserId: string) {
      const record = findAuthorized(kind, id, actorUserId);
      if (!record) return null;
      return clone(record as McpRecord<T>);
    },
    async listForMember<T>(kind: string, actorUserId: string) {
      return (await this.listPageForMember<T>(kind, actorUserId, { limit: 50 })).records;
    },
    async listPageForMember<T>(kind: string, actorUserId: string, options: McpPageOptions) {
      const values = [...records.values()]
        .filter((record) => record.kind === kind && (record.ownerUserId === actorUserId || record.memberUserIds.includes(actorUserId)))
        .filter((record) => !options.filter?.connectionId || (record.value as Record<string, unknown>).connectionId === options.filter.connectionId || (record.value as Record<string, unknown>).connection_id === options.filter.connectionId)
        .filter((record) => !options.filter?.surfaceId || (record.value as Record<string, unknown>).surfaceId === options.filter.surfaceId || (record.value as Record<string, unknown>).surface_id === options.filter.surfaceId)
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter((record) => !options.cursor || record.id > options.cursor);
      const page = values.slice(0, options.limit + 1);
      const hasMore = page.length > options.limit;
      const selected = page.slice(0, options.limit).map((record) => clone(record as McpRecord<T>));
      return { records: selected, nextCursor: hasMore ? selected.at(-1)?.id ?? null : null };
    },
    async write<T>(input: McpRecordWrite<T>) {
      const actor = input.actorUserId ?? input.ownerUserId;
      const inputValue = input.value as Record<string, unknown>;
      const effectiveId = input.kind === "follow_watch" ? canonicalFollowWatchId(String(inputValue.relation), String(inputValue.targetKind), String(inputValue.targetId)) : input.id;
      if (input.kind === "surface_approval") {
        const revisionId = String((input.value as Record<string, unknown>).revisionId ?? "");
        const revision = [...records.values()].find((record) => record.kind === "surface_revision" && record.id === revisionId);
        if (!revision) throw new Error("object_not_authorized");
        if ((revision.value as Record<string, unknown>).visibility === "personal_view") throw new Error("personal_view_not_publishable");
        const surfaceId = String((revision.value as Record<string, unknown>).surfaceId ?? "");
        if (!findAuthorized("surface", surfaceId, actor)) throw new Error("object_not_authorized");
      }
      const previous = findAuthorized(input.kind, effectiveId, actor);
      if (!previous && actor !== input.ownerUserId) throw new Error("object_not_authorized");
      if (input.expectedVersion !== undefined && input.expectedVersion !== (previous?.version ?? null)) throw new Error("version_conflict");
      if (input.kind === "follow_watch" && inputValue.enabled === false) {
        records.delete(key(input.kind, input.ownerUserId, effectiveId));
        return {
          kind: input.kind,
          id: effectiveId,
          ownerUserId: input.ownerUserId,
          memberUserIds: [],
          value: clone(input.value),
          version: (previous?.version ?? 0) + 1,
          createdAt: previous?.createdAt ?? input.now,
          updatedAt: input.now,
        } as McpRecord<T>;
      }
      let nextValue = clone(input.value) as T;
      let approvalToConsume: string | null = null;
      if (input.kind === "source_policy") {
        const source = nextValue as Record<string, unknown>;
        if (source.policy === "ask_each_time" && source.approveNextWorkSignal === true) {
          const approvalId = `source_approval:${actor}:${input.id}:${input.now}`;
          sourceApprovals.set(approvalId, { ownerUserId: actor, sourceId: input.id, expiresAt: Date.parse(input.now) + 15 * 60_000, consumed: false });
          nextValue = { ...source, approvalId } as T;
        }
      }
      if (input.kind === "work_signal") {
        const signal = nextValue as Record<string, unknown>;
        if (!["suggested_connections", "mutual_connections", "private"].includes(String(signal.audience))) throw new Error("work_signal_public_forbidden");
        const source = findAuthorized("source_policy", String(signal.sourceId ?? ""), actor);
        const policy = (source?.value as Record<string, unknown> | undefined)?.policy;
        if (!source || policy === "never" || policy === "actions_only") throw new Error("source_policy_denied");
        if (policy === "ask_each_time") {
          const approvalId = String(signal.sourceApprovalId ?? "");
          const approval = sourceApprovals.get(approvalId);
          if (!approval || approval.ownerUserId !== actor || approval.sourceId !== signal.sourceId || approval.consumed || approval.expiresAt <= Date.parse(input.now)) throw new Error("source_approval_required");
          approvalToConsume = approvalId;
        }
      }
      const record: McpRecord<T> = {
        kind: input.kind,
        id: effectiveId,
        ownerUserId: input.ownerUserId,
        memberUserIds:
          input.kind === "surface_revision" &&
          (nextValue as Record<string, unknown>).visibility === "personal_view"
            ? []
            : [...new Set(input.memberUserIds ?? previous?.memberUserIds ?? [])],
        value: clone(nextValue),
        version: (previous?.version ?? 0) + 1,
        createdAt: previous?.createdAt ?? input.now,
        updatedAt: input.now,
      };
      records.set(key(input.kind, record.ownerUserId, effectiveId), record as McpRecord);
      if (approvalToConsume) sourceApprovals.get(approvalToConsume)!.consumed = true;
      return clone(record);
    },
    async deleteForOwner(kind: string, id: string, actorUserId: string) {
      const record = [...records.values()].find((candidate) => candidate.kind === kind && candidate.id === id && candidate.ownerUserId === actorUserId);
      if (!record || record.ownerUserId !== actorUserId) return false;
      return records.delete(key(kind, record.ownerUserId, id));
    },
    async runIdempotent<T>(input: IdempotentMutation<T>) {
      const idempotencyKey = `${input.actorUserId}\u0000${input.operation}\u0000${input.key}`;
      const previous = idempotency.get(idempotencyKey);
      if (previous) {
        if (previous.requestHash !== input.requestHash) throw new Error("idempotency_conflict");
        if (previous.uncertain) throw new Error("idempotency_in_progress");
        return { replayed: true, value: clone(await previous.promise as T) };
      }
      const promise = Promise.resolve().then(() => input.execute());
      idempotency.set(idempotencyKey, { requestHash: input.requestHash, promise });
      try {
        const value = await promise;
        return { replayed: false, value };
      } catch (error) {
        if (input.preserveLeaseOnError) idempotency.get(idempotencyKey)!.uncertain = true;
        else idempotency.delete(idempotencyKey);
        throw error;
      }
    },
  };
}
