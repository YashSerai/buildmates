export type CapabilityRecordDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): { first<T>(): Promise<T | null> };
  };
};

export function createPrivateCapabilityRepository(DB: CapabilityRecordDatabase) {
  return {
    async readForOwner(id: string, actorUserId: string): Promise<{ id: string; value: string } | null> {
      return DB.prepare("SELECT id, value FROM private_capability_records WHERE id = ? AND owner_user_id = ? LIMIT 1")
        .bind(id, actorUserId).first<{ id: string; value: string }>();
    },
  };
}
