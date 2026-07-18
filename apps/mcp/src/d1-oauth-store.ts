import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { hashOAuthSecret, verifyPkceS256, type DurableOAuthStore, type OAuthTokenPair } from "./oauth";

type Row = {
  id: string; principalId: string; mcpSubject: string; clientId: string; familyId: string; audience: string;
  scopes: string; redirectUri: string | null; pkceChallenge: string | null; expiresAt: number;
  consumedAt: number | null; revokedAt: number | null;
};

export function createD1OAuthStore(DB: D1Database, subjectSecret: string): DurableOAuthStore {
  const opaqueSubject = (issuer: string, subject: string, clientId: string) =>
    `mcp_${createHmac("sha256", subjectSecret).update(`${issuer}\0${subject}\0${clientId}`).digest("base64url")}`;
  const secret = () => randomBytes(32).toString("base64url");

  return {
    async issueAuthorizationCode(input) {
      const now = Date.now();
      const mcpSubject = opaqueSubject(input.webIdentity.issuer, input.webIdentity.subject, input.clientId);
      const principalId = `prn_${createHmac("sha256", subjectSecret).update(mcpSubject).digest("hex")}`;
      const code = secret();
      await DB.batch([
        DB.prepare("INSERT OR IGNORE INTO identity_principals (id, channel, issuer, subject, workspace_scope, created_at, revoked_at) VALUES (?, 'mcp', 'buildmates_mcp', ?, 'global', ?, NULL)").bind(principalId, mcpSubject, now),
        DB.prepare("INSERT INTO oauth_tokens (id, principal_id, token_hash, token_kind, client_id, family_id, audience, scopes, redirect_uri, pkce_challenge, expires_at, consumed_at, consumed_by_id, revoked_at, rotated_from_id, created_at) VALUES (?, ?, ?, 'authorization_code', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?)")
          .bind(randomUUID(), principalId, hashOAuthSecret(code), input.clientId, randomUUID(), input.audience, input.scopes.join(" "), input.redirectUri, input.codeChallenge, input.expiresAt, now),
      ]);
      return code;
    },

    async exchangeAuthorizationCode(input) {
      const now = Date.now();
      const row = await findToken(DB, hashOAuthSecret(input.code), "authorization_code");
      if (!row || row.clientId !== input.clientId || row.redirectUri !== input.redirectUri || row.audience !== input.audience || row.expiresAt <= now || !row.pkceChallenge || !verifyPkceS256(input.codeVerifier, row.pkceChallenge)) return null;
      return rotateFrom(DB, row, now, input.accessTokenTtlSeconds, input.refreshTokenTtlSeconds);
    },

    async rotateRefreshToken(input) {
      const now = Date.now();
      const row = await findRefreshTokenIncludingConsumed(DB, hashOAuthSecret(input.refreshToken));
      if (!row || row.clientId !== input.clientId || row.audience !== input.audience || row.expiresAt <= now || row.revokedAt !== null) return null;
      // A public native client can race two refreshes when overlapping MCP calls
      // notice the same expired access token. The consumed token remains unusable,
      // but rejecting that stale request must not revoke the successor already
      // returned to the winning call.
      if (row.consumedAt !== null) return null;
      return rotateFrom(DB, row, now, input.accessTokenTtlSeconds, input.refreshTokenTtlSeconds);
    },

    async validateAccessToken(token, audience) {
      const now = Date.now();
      const row = await findToken(DB, hashOAuthSecret(token), "access");
      if (!row || row.audience !== audience || row.expiresAt <= now) return null;
      return { mcpSubject: row.mcpSubject, clientId: row.clientId, scopes: row.scopes.split(" "), audience: row.audience, expiresAt: row.expiresAt };
    },

    async revoke(token, clientId) {
      const row = await findToken(DB, hashOAuthSecret(token));
      if (row?.clientId === clientId) await DB.prepare("UPDATE oauth_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL").bind(Date.now(), row.familyId).run();
    },
  };
}

async function findToken(DB: D1Database, hash: string, kind?: "authorization_code" | "access" | "refresh"): Promise<Row | null> {
  const suffix = kind ? " AND t.token_kind = ?" : "";
  const statement = DB.prepare(`SELECT t.id, t.principal_id AS principalId, p.subject AS mcpSubject, t.client_id AS clientId, t.family_id AS familyId, t.audience, t.scopes, t.redirect_uri AS redirectUri, t.pkce_challenge AS pkceChallenge, t.expires_at AS expiresAt, t.consumed_at AS consumedAt, t.revoked_at AS revokedAt FROM oauth_tokens t JOIN identity_principals p ON p.id = t.principal_id WHERE t.token_hash = ?${suffix} AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND p.revoked_at IS NULL LIMIT 1`);
  return kind ? statement.bind(hash, kind).first<Row>() : statement.bind(hash).first<Row>();
}

async function findRefreshTokenIncludingConsumed(DB: D1Database, hash: string): Promise<Row | null> {
  return DB.prepare("SELECT t.id, t.principal_id AS principalId, p.subject AS mcpSubject, t.client_id AS clientId, t.family_id AS familyId, t.audience, t.scopes, t.redirect_uri AS redirectUri, t.pkce_challenge AS pkceChallenge, t.expires_at AS expiresAt, t.consumed_at AS consumedAt, t.revoked_at AS revokedAt FROM oauth_tokens t JOIN identity_principals p ON p.id = t.principal_id WHERE t.token_hash = ? AND t.token_kind = 'refresh' AND p.revoked_at IS NULL LIMIT 1")
    .bind(hash).first<Row>();
}

async function rotateFrom(DB: D1Database, row: Row, now: number, accessTtl: number, refreshTtl: number): Promise<OAuthTokenPair | null> {
  const accessToken = randomBytes(32).toString("base64url");
  const refreshToken = randomBytes(32).toString("base64url");
  const accessId = randomUUID();
  const refreshId = randomUUID();
  try {
    const results = await DB.batch([
      DB.prepare("UPDATE oauth_tokens SET consumed_at = ?, consumed_by_id = ? WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ?").bind(now, accessId, row.id, now),
      DB.prepare("INSERT INTO oauth_tokens (id, principal_id, token_hash, token_kind, client_id, family_id, audience, scopes, redirect_uri, pkce_challenge, expires_at, consumed_at, consumed_by_id, revoked_at, rotated_from_id, created_at) SELECT ?, principal_id, ?, 'access', client_id, family_id, audience, scopes, NULL, NULL, ?, NULL, NULL, NULL, id, ? FROM oauth_tokens WHERE id = ? AND consumed_by_id = ?")
        .bind(accessId, hashOAuthSecret(accessToken), now + accessTtl * 1000, now, row.id, accessId),
      DB.prepare("INSERT INTO oauth_tokens (id, principal_id, token_hash, token_kind, client_id, family_id, audience, scopes, redirect_uri, pkce_challenge, expires_at, consumed_at, consumed_by_id, revoked_at, rotated_from_id, created_at) SELECT ?, principal_id, ?, 'refresh', client_id, family_id, audience, scopes, NULL, NULL, ?, NULL, NULL, NULL, id, ? FROM oauth_tokens WHERE id = ? AND consumed_by_id = ?")
        .bind(refreshId, hashOAuthSecret(refreshToken), now + refreshTtl * 1000, now, row.id, accessId),
    ]);
    const changed = Number((results[0].meta as { changes?: number } | undefined)?.changes ?? 0);
    if (changed === 1) return { accessToken, refreshToken, expiresIn: accessTtl, scope: row.scopes };
  } catch {
    // A concurrent winner may have consumed this refresh before this batch.
  }
  // Losing a compare-and-set race is equivalent to presenting an already-used
  // refresh token: reject it without invalidating the winner's token family.
  // Explicit revocation still revokes the complete family through revoke().
  return null;
}
