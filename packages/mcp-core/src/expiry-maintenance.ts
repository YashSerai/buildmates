type BoundStatement = { run(): Promise<{ meta?: { changes?: number } }> };
type Database = { prepare(sql: string): { bind(...values: unknown[]): BoundStatement } };

export async function pruneExpiredAssertionReplays(database: unknown, now: number, limit = 100) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const DB = database as Database;
  return DB.prepare(`DELETE FROM assertion_replays WHERE jti IN (SELECT jti FROM assertion_replays WHERE expires_at <= ? ORDER BY expires_at LIMIT ${boundedLimit})`).bind(now).run();
}

export async function pruneExpiredMcpRateLimits(database: unknown, now: number, limit = 100) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const DB = database as Database;
  return DB.prepare(`DELETE FROM mcp_rate_limits WHERE key IN (SELECT key FROM mcp_rate_limits WHERE window_expires_at <= ? ORDER BY window_expires_at LIMIT ${boundedLimit})`).bind(now).run();
}
