import { internalUserKey, requireApiIdentity } from "@/src/platform/identity";
import { getPlatformBindings } from "@/src/platform/bindings";

const CODE_TTL_MS = 10 * 60 * 1000;

export async function POST() {
  const identity = await requireApiIdentity();
  if (identity instanceof Response) return identity;
  const userId = internalUserKey(identity);
  const { DB } = await getPlatformBindings();
  const now = Date.now();
  const recent = await DB.prepare(
    "SELECT COUNT(*) AS count FROM identity_link_codes WHERE user_id = ? AND created_at > ?",
  ).bind(userId, now - 60 * 60 * 1000).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 5) {
    return Response.json({ error: "link_code_rate_limited" }, { status: 429, headers: { "retry-after": "3600" } });
  }

  const code = randomCode();
  const codeHash = await sha256(code);
  const expiresAt = now + CODE_TTL_MS;
  await DB.prepare(
    "INSERT INTO identity_link_codes (id, user_id, code_hash, workspace_scope, expires_at, attempt_count, max_attempts, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, 0, 5, NULL, ?)",
  ).bind(crypto.randomUUID(), userId, codeHash, identity.workspaceScope, expiresAt, now).run();
  return Response.json(
    { code, expiresAt: new Date(expiresAt).toISOString() },
    { status: 201, headers: { "cache-control": "no-store", pragma: "no-cache" } },
  );
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
