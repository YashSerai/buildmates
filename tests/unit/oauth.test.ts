import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isRegisteredChatGptRedirect,
  isRegisteredRedirect,
  oauthDiscovery,
  type OAuth21Config,
  validateAuthorizationRequest,
  verifyPkceS256,
} from "../../apps/mcp/src/oauth";

const config: OAuth21Config = {
  issuer: "https://mcp.example",
  resource: "https://mcp.example/mcp",
  registeredRedirectUris: new Map([["codex", ["https://chatgpt.com/connector/oauth/legacy"]]]),
  dynamicClientRegistrationSecret: "registration-secret-that-is-long-enough",
  allowedScopes: new Set(["mcp:tools"]),
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 86_400,
};

describe("Buildmates OAuth compatibility", () => {
  it("advertises issuer-bound responses and CIMD support", () => {
    expect(oauthDiscovery(config)).toMatchObject({
      authorization_response_iss_parameter_supported: true,
      client_id_metadata_document_supported: true,
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("accepts the stable ChatGPT CIMD client only at the stable callback", () => {
    const client = "https://chatgpt.com/oauth/client.json";
    expect(isRegisteredChatGptRedirect(client, "https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isRegisteredRedirect(config, client, "https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isRegisteredChatGptRedirect(client, "https://chatgpt.com/connector/oauth/other")).toBe(false);
    expect(isRegisteredChatGptRedirect(client, "https://attacker.example/connector_platform_oauth_redirect")).toBe(false);
  });

  it("binds a callback-specific ChatGPT CIMD client to its matching redirect", () => {
    const client = "https://chatgpt.com/oauth/X9cijyDLeWHf/client.json";
    expect(isRegisteredChatGptRedirect(client, "https://chatgpt.com/connector/oauth/X9cijyDLeWHf")).toBe(true);
    expect(isRegisteredChatGptRedirect(client, "https://chatgpt.com/connector/oauth/another-callback")).toBe(false);
    expect(isRegisteredChatGptRedirect("https://chatgpt.com/oauth/X9cijyDLeWHf.evil/client.json", "https://chatgpt.com/connector/oauth/X9cijyDLeWHf.evil")).toBe(false);
    expect(isRegisteredChatGptRedirect(client, "https://chatgpt.com/connector/oauth/X9cijyDLeWHf?next=https://attacker.example")).toBe(false);
  });

  it("does not treat lookalike client metadata or redirect origins as ChatGPT", () => {
    expect(isRegisteredChatGptRedirect("https://chatgpt.com.attacker.example/oauth/client.json", "https://chatgpt.com/connector_platform_oauth_redirect")).toBe(false);
    expect(isRegisteredChatGptRedirect("https://chatgpt.com/oauth/client.json?redirect=https://attacker.example", "https://chatgpt.com/connector_platform_oauth_redirect")).toBe(false);
    expect(isRegisteredChatGptRedirect("https://chatgpt.com/oauth/client.json", "https://chatgpt.com.evil/connector_platform_oauth_redirect")).toBe(false);
    expect(isRegisteredChatGptRedirect("https://chatgpt.com/oauth/client.json", "http://chatgpt.com/connector_platform_oauth_redirect")).toBe(false);
  });

  it("validates CIMD authorization requests against the resource and scope", () => {
    expect(validateAuthorizationRequest({
      response_type: "code",
      client_id: "https://chatgpt.com/oauth/client.json",
      redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
      code_challenge: "y".repeat(43),
      code_challenge_method: "S256",
      scope: "mcp:tools",
      state: "state-123",
      resource: "https://mcp.example/mcp",
    }, config)).toMatchObject({ client_id: "https://chatgpt.com/oauth/client.json", scopes: ["mcp:tools"] });
    expect(() => validateAuthorizationRequest({
      response_type: "code",
      client_id: "https://chatgpt.com/oauth/client.json",
      redirect_uri: "https://chatgpt.com/connector/oauth/other",
      code_challenge: "y".repeat(43),
      code_challenge_method: "S256",
      scope: "mcp:tools",
      state: "state-123",
      resource: "https://mcp.example/mcp",
    }, config)).toThrow("unregistered_redirect_uri");
  });

  it("accepts only RFC 7636 verifier characters and the matching S256 digest", () => {
    const verifier = "v".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256(`${verifier} `, challenge)).toBe(false);
    expect(verifyPkceS256(verifier, "not-a-valid-challenge")).toBe(false);
  });
});
