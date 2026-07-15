import { createHash, createPrivateKey, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { canonicalToolInputHash, type BuildmatesToolServices, type CompleteIdentityLinkResult } from "@buildmates/mcp-core";

export type ExternalLinkClientConfig = {
  webDataUrl: string;
  issuer: string;
  audience: string;
  privateKeyPem: string;
  keyId: string;
  fetch?: typeof globalThis.fetch;
};

export function createExternalIdentityLinkService(config: ExternalLinkClientConfig): Pick<BuildmatesToolServices, "completeIdentityLink" | "executeRemoteTool"> {
  return {
    async completeIdentityLink({ mcpSubject, code, workspaceScope }) {
      if (workspaceScope !== "global") return { linked: false, reason: "invalid_or_expired" };
      const assertion = await delegatedAssertion(config, mcpSubject, "identity.link.complete", "identity:link:complete");
      const response = await (config.fetch ?? fetch)(config.webDataUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${assertion}`, "content-type": "application/json" },
        body: JSON.stringify({ action: "identity.link.complete", code, workspaceScope }),
      });
      const result = await response.json() as CompleteIdentityLinkResult;
      return response.ok ? result : { linked: false, reason: response.status === 429 ? "rate_limited" : "invalid_or_expired" };
    },
    async executeRemoteTool({ name, input, mcpSubject }) {
      const inputHash = await canonicalToolInputHash(input);
      const action = `tool.execute:${name}`;
      const assertion = await delegatedAssertion(config, mcpSubject, action, `mcp:tool:${name}`, { tool: name, input_hash: inputHash });
      const response = await (config.fetch ?? fetch)(config.webDataUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${assertion}`, "content-type": "application/json" },
        body: JSON.stringify({ action, tool: name, input }),
      });
      const body = await response.json() as { value?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error ?? "remote_tool_failed");
      return body.value;
    },
  };
}

async function delegatedAssertion(config: ExternalLinkClientConfig, subject: string, action: string, scope: string, claims: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ action, scope, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: config.keyId, typ: "JWT" })
    .setIssuer(config.issuer).setAudience(config.audience).setSubject(subject)
    .setJti(randomUUID()).setIssuedAt(now).setExpirationTime(now + 60)
    .sign(createPrivateKey(config.privateKeyPem));
}

export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
