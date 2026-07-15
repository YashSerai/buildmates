import { createHash, createPrivateKey, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { CompleteIdentityLinkResult, IdentityToolServices } from "@buildmates/mcp-core";

export type ExternalLinkClientConfig = {
  webDataUrl: string;
  issuer: string;
  audience: string;
  privateKeyPem: string;
  keyId: string;
  fetch?: typeof globalThis.fetch;
};

export function createExternalIdentityLinkService(config: ExternalLinkClientConfig): Pick<IdentityToolServices, "completeIdentityLink"> {
  return {
    async completeIdentityLink({ mcpSubject, code, workspaceScope }) {
      const now = Math.floor(Date.now() / 1000);
      const assertion = await new SignJWT({ action: "identity.link.complete", scope: "identity:link:complete" })
        .setProtectedHeader({ alg: "RS256", kid: config.keyId, typ: "JWT" })
        .setIssuer(config.issuer).setAudience(config.audience).setSubject(mcpSubject)
        .setJti(randomUUID()).setIssuedAt(now).setExpirationTime(now + 60)
        .sign(createPrivateKey(config.privateKeyPem));
      const response = await (config.fetch ?? fetch)(config.webDataUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${assertion}`, "content-type": "application/json" },
        body: JSON.stringify({ action: "identity.link.complete", code, workspaceScope }),
      });
      const result = await response.json() as CompleteIdentityLinkResult;
      return response.ok ? result : { linked: false, reason: response.status === 429 ? "rate_limited" : "invalid_or_expired" };
    },
  };
}

export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
