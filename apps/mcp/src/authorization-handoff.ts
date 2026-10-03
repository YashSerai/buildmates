import { randomBytes } from "node:crypto";
import { importSPKI, jwtVerify } from "jose";
import { hashOAuthSecret, type AuthorizedWebIdentity } from "./oauth";

export type AuthorizationHandoffConfig = {
  DB: D1Database;
  webBaseUrl: string;
  mcpBaseUrl: string;
  publicKeyPem: string;
  issuer: string;
  audience: string;
};

export function createAuthorizationHandoff(config: AuthorizationHandoffConfig) {
  return {
    async begin(request: Request): Promise<Response> {
      if (request.url.length > 4096) return Response.json({ error: "request_uri_too_large" }, { status: 400 });
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname !== "/oauth/authorize" || !sameOrigin(requestUrl, config.mcpBaseUrl)) return Response.json({ error: "invalid_handoff" }, { status: 400 });
      const state = randomBytes(32).toString("base64url");
      const now = Date.now();
      await config.DB.prepare("INSERT INTO oauth_authorization_handoffs (state_hash, request_uri, expires_at, consumed_at, consumed_by_jti, created_at) VALUES (?, ?, ?, NULL, NULL, ?)")
        .bind(hashOAuthSecret(state), request.url, now + 5 * 60 * 1000, now).run();
      const callback = new URL("/oauth/web-callback", config.mcpBaseUrl);
      callback.searchParams.set("handoff", state);
      const web = new URL("/api/identity/mcp-authorization", config.webBaseUrl);
      web.searchParams.set("return_to", callback.toString());
      return new Response(null, { status: 302, headers: { location: web.toString(), "cache-control": "no-store", pragma: "no-cache", "referrer-policy": "no-referrer" } });
    },

    async complete(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname !== "/oauth/web-callback" || !sameOrigin(url, config.mcpBaseUrl)) return Response.json({ error: "invalid_handoff" }, { status: 400 });
      const state = url.searchParams.get("handoff");
      const assertion = url.searchParams.get("assertion");
      if (!state || !assertion) return Response.json({ error: "invalid_handoff" }, { status: 400 });
      const key = await importSPKI(config.publicKeyPem, "RS256");
      const { payload } = await jwtVerify(assertion, key, {
        issuer: config.issuer, audience: config.audience, algorithms: ["RS256"], maxTokenAge: "2m",
      });
      if (typeof payload.sub !== "string" || typeof payload.jti !== "string" || typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now() || payload.channel !== "web" || payload.handoff_hash !== hashOAuthSecret(state)) return Response.json({ error: "invalid_web_identity_assertion" }, { status: 401 });
      const stateHash = hashOAuthSecret(state);
      const row = await config.DB.prepare("SELECT request_uri AS requestUri FROM oauth_authorization_handoffs WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ? LIMIT 1")
        .bind(stateHash, Date.now()).first<{ requestUri: string }>();
      if (!row) return Response.json({ error: "expired_or_consumed_handoff" }, { status: 400 });
      const now = Date.now();
      try {
        const results = await config.DB.batch([
          config.DB.prepare("UPDATE oauth_authorization_handoffs SET consumed_at = ?, consumed_by_jti = ? WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?").bind(now, payload.jti, stateHash, now),
          config.DB.prepare("INSERT INTO assertion_replays (jti, issuer, subject, action, expires_at, created_at) VALUES (?, ?, ?, 'oauth.web-authorization', ?, ?)")
            .bind(payload.jti, payload.iss, payload.sub, Number(payload.exp) * 1000, now),
        ]);
        if (Number((results[0].meta as { changes?: number }).changes ?? 0) !== 1) return Response.json({ error: "expired_or_consumed_handoff" }, { status: 400 });
      } catch { return Response.json({ error: "expired_or_consumed_handoff" }, { status: 400 }); }
      return new Response(null, {
        status: 302,
        headers: {
          location: row.requestUri,
          "set-cookie": `bm_web_authorization=${encodeURIComponent(assertion)}~${hashOAuthSecret(row.requestUri)}; Max-Age=120; Path=/oauth; HttpOnly; Secure; SameSite=Lax`,
          "cache-control": "no-store", "referrer-policy": "no-referrer",
        },
      });
    },

    async identity(request: Request): Promise<AuthorizedWebIdentity | null> {
      if (!sameOrigin(new URL(request.url), config.mcpBaseUrl)) return null;
      const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("bm_web_authorization="))?.slice("bm_web_authorization=".length);
      if (!cookie) return null;
      try {
        const separator = cookie.lastIndexOf("~");
        if (separator < 1 || cookie.slice(separator + 1) !== hashOAuthSecret(request.url)) return null;
        const assertion = decodeURIComponent(cookie.slice(0, separator));
        const key = await importSPKI(config.publicKeyPem, "RS256");
        const { payload } = await jwtVerify(assertion, key, { issuer: config.issuer, audience: config.audience, algorithms: ["RS256"], maxTokenAge: "2m" });
        return typeof payload.sub === "string" && payload.sub.length > 0 && typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now() && payload.channel === "web"
          ? { issuer: config.issuer, subject: payload.sub }
          : null;
      } catch { return null; }
    },
  };
}

function sameOrigin(value: URL, expectedBaseUrl: string): boolean {
  try {
    return value.origin === new URL(expectedBaseUrl).origin;
  } catch {
    return false;
  }
}
