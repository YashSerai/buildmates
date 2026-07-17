import { getPlatformBindings } from "../platform/bindings";

export const SESSION_COOKIE = "__Host-buildmates_session";
export const OAUTH_COOKIE = "__Host-buildmates_oauth";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 10 * 60 * 1000;

export type GithubProfile = { id: number; login: string; name: string | null };

export async function beginGithubLogin(returnTo: string, origin: string) {
  const clientId = requiredEnv("GITHUB_CLIENT_ID");
  const state = randomSecret(32);
  const verifier = randomSecret(48);
  const stateHash = await sha256(state);
  const challenge = await sha256Base64Url(verifier);
  const now = Date.now();
  const { DB } = await getPlatformBindings();
  await DB.prepare("INSERT INTO web_login_attempts (state_hash,provider,code_verifier,return_to,expires_at,consumed_at,created_at) VALUES (?,'github',?,?,?,?,?)")
    .bind(stateHash, verifier, safeReturnPath(returnTo), now + LOGIN_TTL_MS, null, now).run();
  const callback = process.env.GITHUB_CALLBACK_URL || `${origin}/api/auth/github/callback`;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return { authorizeUrl: authorize.toString(), state, expiresAt: now + LOGIN_TTL_MS };
}

export async function finishGithubLogin(input: { code: string; state: string; stateCookie: string; origin: string; fetch?: typeof fetch }) {
  if (!input.state || !timingSafeEqual(input.state, input.stateCookie)) throw new Error("oauth_state_mismatch");
  const { DB } = await getPlatformBindings();
  const stateHash = await sha256(input.state);
  const now = Date.now();
  const attempt = await DB.prepare("SELECT code_verifier AS codeVerifier,return_to AS returnTo FROM web_login_attempts WHERE state_hash=? AND provider='github' AND consumed_at IS NULL AND expires_at>? LIMIT 1")
    .bind(stateHash, now).first<{ codeVerifier: string; returnTo: string }>();
  if (!attempt) throw new Error("oauth_state_expired");
  const consumed = await DB.prepare("UPDATE web_login_attempts SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL AND expires_at>?")
    .bind(now, stateHash, now).run();
  if (Number((consumed.meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) throw new Error("oauth_state_replayed");

  const callback = process.env.GITHUB_CALLBACK_URL || `${input.origin}/api/auth/github/callback`;
  const requestFetch = input.fetch ?? fetch;
  const tokenResponse = await requestFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: requiredEnv("GITHUB_CLIENT_ID"), client_secret: requiredEnv("GITHUB_CLIENT_SECRET"), code: input.code, redirect_uri: callback, code_verifier: attempt.codeVerifier }),
  });
  const tokenBody = await tokenResponse.json() as { access_token?: unknown; error?: unknown };
  if (!tokenResponse.ok || typeof tokenBody.access_token !== "string" || !tokenBody.access_token) throw new Error("github_token_exchange_failed");
  const profileResponse = await requestFetch("https://api.github.com/user", {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${tokenBody.access_token}`, "user-agent": "Buildmates", "x-github-api-version": "2022-11-28" },
  });
  const rawProfile = await profileResponse.json() as { id?: unknown; login?: unknown; name?: unknown };
  if (!profileResponse.ok || !Number.isSafeInteger(rawProfile.id) || Number(rawProfile.id) <= 0 || typeof rawProfile.login !== "string") throw new Error("github_identity_invalid");
  const profile: GithubProfile = { id: Number(rawProfile.id), login: rawProfile.login, name: typeof rawProfile.name === "string" ? rawProfile.name : null };
  const session = await establishGithubSession(DB, profile, now);
  return { ...session, returnTo: session.accountStatus === "suspended" ? "/account/appeal" : safeReturnPath(attempt.returnTo), profile };
}

export async function establishGithubSession(DB: D1Database, profile: GithubProfile, now: number) {
  const subject = String(profile.id);
  const existing = await DB.prepare("SELECT p.id AS principalId,p.revoked_at AS principalRevokedAt,l.user_id AS userId,l.revoked_at AS linkRevokedAt,u.status FROM identity_principals p LEFT JOIN identity_links l ON l.principal_id=p.id LEFT JOIN users u ON u.id=l.user_id WHERE p.channel='web' AND p.issuer='github.com' AND p.subject=? AND p.workspace_scope='global' LIMIT 1")
    .bind(subject).first<{ principalId: string; principalRevokedAt: number | null; userId: string | null; linkRevokedAt: number | null; status: string | null }>();
  if (existing && (existing.principalRevokedAt !== null || existing.linkRevokedAt !== null || !["active", "suspended"].includes(existing.status ?? "") || !existing.userId)) throw new Error("account_unavailable");

  const userId = existing?.userId ?? crypto.randomUUID();
  const principalId = existing?.principalId ?? crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const sessionSecret = randomSecret(32);
  const tokenHash = await sha256(sessionSecret);
  const expiresAt = now + SESSION_TTL_MS;
  if (existing) {
    await DB.prepare("INSERT INTO web_sessions (id,user_id,principal_id,token_hash,expires_at,last_seen_at,revoked_at,created_at) VALUES (?,?,?,?,?,?,NULL,?)")
      .bind(sessionId, userId, principalId, tokenHash, expiresAt, now, now).run();
  } else {
    try {
      await DB.batch([
        DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(userId, now, now),
        DB.prepare("INSERT INTO identity_principals (id,channel,issuer,subject,workspace_scope,created_at,revoked_at) VALUES (?,'web','github.com',?,'global',?,NULL)").bind(principalId, subject, now),
        DB.prepare("INSERT INTO identity_links (id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at,revoked_at) VALUES (?,?,?,'web','github.com',?,'global',?,NULL)").bind(crypto.randomUUID(), userId, principalId, subject, now),
        DB.prepare("INSERT INTO web_sessions (id,user_id,principal_id,token_hash,expires_at,last_seen_at,revoked_at,created_at) VALUES (?,?,?,?,?,?,NULL,?)").bind(sessionId, userId, principalId, tokenHash, expiresAt, now, now),
      ]);
    } catch {
      const winner = await DB.prepare("SELECT l.user_id AS userId,p.id AS principalId,u.status,p.revoked_at AS principalRevokedAt,l.revoked_at AS linkRevokedAt FROM identity_principals p JOIN identity_links l ON l.principal_id=p.id JOIN users u ON u.id=l.user_id WHERE p.channel='web' AND p.issuer='github.com' AND p.subject=? AND p.workspace_scope='global' LIMIT 1")
        .bind(subject).first<{ userId: string; principalId: string; status: string; principalRevokedAt: number | null; linkRevokedAt: number | null }>();
      if (!winner || !["active", "suspended"].includes(winner.status) || winner.principalRevokedAt !== null || winner.linkRevokedAt !== null) throw new Error("account_unavailable");
      await DB.prepare("INSERT INTO web_sessions (id,user_id,principal_id,token_hash,expires_at,last_seen_at,revoked_at,created_at) VALUES (?,?,?,?,?,?,NULL,?)")
        .bind(sessionId, winner.userId, winner.principalId, tokenHash, expiresAt, now, now).run();
      return { userId: winner.userId, cookieValue: `${sessionId}.${sessionSecret}`, expiresAt, accountStatus: winner.status as "active" | "suspended" };
    }
  }
  return { userId, cookieValue: `${sessionId}.${sessionSecret}`, expiresAt, accountStatus: (existing?.status ?? "active") as "active" | "suspended" };
}

export function sessionCookie(value: string, maxAge = Math.floor(SESSION_TTL_MS / 1000)): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function oauthCookie(value: string, maxAge = Math.floor(LOGIN_TTL_MS / 1000)): string {
  return `${OAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64Url(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return base64Url(bytes);
}

function randomSecret(length: number): string { const bytes = crypto.getRandomValues(new Uint8Array(length)); return base64Url(bytes); }
function base64Url(bytes: Uint8Array): string { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function timingSafeEqual(left: string, right: string): boolean { if (left.length !== right.length) return false; let diff = 0; for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index); return diff === 0; }
function requiredEnv(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name.toLowerCase()}_missing`); return value; }
export function safeReturnPath(value: string | null | undefined): string { if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/"; try { const url = new URL(value, "https://buildmates.local"); if (url.origin !== "https://buildmates.local" || url.pathname.startsWith("/api/auth/")) return "/"; return `${url.pathname}${url.search}${url.hash}`; } catch { return "/"; } }
