import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeReturnPath, sha256 } from "../auth/github-oauth";
import { getPlatformBindings } from "./bindings";

export type PlatformIdentity = {
  channel: "web";
  issuer: "github.com";
  subject: string;
  workspaceScope: "global";
  displayName: string | null;
  userId: string;
  sessionId: string;
};

export async function getPlatformIdentity(): Promise<PlatformIdentity | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  const separator = value.indexOf(".");
  if (separator < 1) return null;
  const sessionId = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  if (!sessionId || !secret || secret.length > 256) return null;
  const { DB } = await getPlatformBindings();
  const row = await DB.prepare(`SELECT s.id AS sessionId,s.user_id AS userId,p.subject
    FROM web_sessions s
    JOIN users u ON u.id=s.user_id AND u.status='active'
    JOIN identity_principals p ON p.id=s.principal_id AND p.channel='web' AND p.issuer='github.com' AND p.revoked_at IS NULL
    JOIN identity_links l ON l.principal_id=p.id AND l.user_id=u.id AND l.provider_channel='web' AND l.provider_issuer='github.com' AND l.revoked_at IS NULL
    WHERE s.id=? AND s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? LIMIT 1`)
    .bind(sessionId, await sha256(secret), Date.now()).first<{ sessionId: string; userId: string; subject: string }>();
  if (!row) return null;
  return { channel: "web", issuer: "github.com", subject: row.subject, workspaceScope: "global", displayName: null, userId: row.userId, sessionId: row.sessionId };
}

export async function requirePlatformIdentity(returnTo: string): Promise<PlatformIdentity> {
  const identity = await getPlatformIdentity();
  if (identity) return identity;
  redirect(`/api/auth/github/start?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export async function requireApiIdentity(): Promise<PlatformIdentity | Response> {
  const identity = await getPlatformIdentity();
  return identity ?? Response.json({ error: "authentication_required" }, { status: 401, headers: { "cache-control": "private, no-store", vary: "Cookie" } });
}

export function internalUserKey(identity: PlatformIdentity): string { return identity.userId; }
export function hasUnstableIdentityHint(): boolean { return false; }
