import { importPKCS8, SignJWT } from "jose";

export async function createMcpAuthorizationAssertion(
  identity: { channel: "web"; subject: string; workspaceScope: "global" },
  config: { privateKeyPem: string; issuer: string; audience: string; keyId: string; now?: number },
): Promise<string> {
  const now = config.now ?? Math.floor(Date.now() / 1000);
  const key = await importPKCS8(config.privateKeyPem, "RS256");
  return new SignJWT({ channel: identity.channel, workspace_scope: identity.workspaceScope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: config.keyId })
    .setIssuer(config.issuer).setAudience(config.audience).setSubject(identity.subject)
    .setJti(crypto.randomUUID()).setIssuedAt(now).setExpirationTime(now + 120).sign(key);
}
