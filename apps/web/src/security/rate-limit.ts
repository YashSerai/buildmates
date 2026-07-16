export class WebRateLimitError extends Error {
  readonly code = "rate_limited";
  constructor(readonly retryAfterSeconds: number) {
    super("rate_limited");
  }
}

export async function consumeWebRateLimit(
  DB: D1Database,
  scope: string,
  actorId: string,
  limit: number,
  windowMs = 60 * 60 * 1000,
  now = Date.now(),
): Promise<void> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = windowStart + windowMs;
  const key = `web:${scope}:${actorId}:${windowStart}`;
  await DB.prepare(
    "INSERT INTO mcp_rate_limits(key,attempt_count,window_expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempt_count=attempt_count+1",
  ).bind(key, expiresAt).run();
  const row = await DB.prepare(
    "SELECT attempt_count AS attempts FROM mcp_rate_limits WHERE key=?",
  ).bind(key).first<{ attempts: number }>();
  if ((row?.attempts ?? limit + 1) > limit) {
    throw new WebRateLimitError(Math.max(1, Math.ceil((expiresAt - now) / 1000)));
  }
}
