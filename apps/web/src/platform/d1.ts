export type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean; meta?: unknown }>;
      first<T>(): Promise<T | null>;
    };
  };
};

export async function runD1Diagnostic(db: D1Like, actorKey: string) {
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO platform_capability_checks (id, actor_key, created_at) VALUES (?, ?, ?)")
    .bind(id, actorKey, Date.now()).run();
  const row = await db.prepare("SELECT id, actor_key AS actorKey FROM platform_capability_checks WHERE id = ? AND actor_key = ?")
    .bind(id, actorKey).first<{ id: string; actorKey: string }>();
  await db.prepare("DELETE FROM platform_capability_checks WHERE id = ? AND actor_key = ?").bind(id, actorKey).run();
  if (!row || row.actorKey !== actorKey) throw new Error("D1 object authorization diagnostic failed");
  return { binding: "DB", insert: true, read: true, delete: true } as const;
}
