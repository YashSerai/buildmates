import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type CompleteIdentityLinkResult = { linked: true } | { linked: false; reason: "invalid_or_expired" | "conflict" | "rate_limited" };

export type IdentityToolServices = {
  linkBaseUrl: string;
  completeIdentityLink(input: { mcpSubject: string; code: string; workspaceScope: string }): Promise<CompleteIdentityLinkResult>;
  allowAttempt(input: { mcpSubject: string; operation: "complete_identity_link" }): Promise<boolean>;
};

export const identityToolNames = ["get_link_url", "complete_identity_link"] as const;

export function registerIdentityTools(server: McpServer, services: IdentityToolServices): void {
  server.registerTool(
    "get_link_url",
    {
      title: "Get Buildmates identity link URL",
      description: "Returns the web page where the authenticated MCP principal can obtain a one-time link code. No user data is returned before linking.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (extra) => {
      requireMcpSubject(extra.authInfo?.extra?.mcp_sub);
      return { content: [{ type: "text", text: JSON.stringify({ url: new URL("/settings/connections", services.linkBaseUrl).toString() }) }] };
    },
  );

  server.registerTool(
    "complete_identity_link",
    {
      title: "Complete Buildmates identity link",
      description: "Consumes a short-lived, single-use code. This is the only user-data mutation allowed before identity linking.",
      inputSchema: {
        code: z.string().trim().regex(/^[A-F0-9]{32}$/),
        workspaceScope: z.string().trim().min(1).max(128).default("global"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ code, workspaceScope }, extra) => {
      const mcpSubject = requireMcpSubject(extra.authInfo?.extra?.mcp_sub);
      if (!(await services.allowAttempt({ mcpSubject, operation: "complete_identity_link" }))) {
        return toolResult({ linked: false, reason: "rate_limited" });
      }
      return toolResult(await services.completeIdentityLink({ mcpSubject, code, workspaceScope }));
    },
  );
}

function requireMcpSubject(value: unknown): string {
  if (typeof value !== "string" || value.length < 16) throw new Error("OAuth-authenticated MCP subject required");
  return value;
}

function toolResult(value: CompleteIdentityLinkResult) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError: !value.linked };
}
