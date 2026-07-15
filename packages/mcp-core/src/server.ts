import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIdentityTools, type IdentityToolServices, identityToolNames } from "./tools/identity";

export const BUILD_MATES_MCP_TOOLS = identityToolNames;

export function createBuildmatesMcpServer(services: IdentityToolServices): McpServer {
  const server = new McpServer({ name: "buildmates", version: "0.1.0" });
  registerIdentityTools(server, services);
  return server;
}
