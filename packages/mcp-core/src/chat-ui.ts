import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BUILD_MATES_CHAT_UI_HTML } from "./chat-ui/widget";
import { BUILD_MATES_CHAT_ACTION_TOOL_NAMES } from "./chat-tool-groups";

/**
 * Resource URI is a cache key in MCP Apps. Increment the version when the
 * embedded HTML contract or behavior changes incompatibly.
 */
export const BUILD_MATES_UI_RESOURCE_URI = "ui://buildmates/workspace/v1.html";
export const BUILD_MATES_UI_MIME_TYPE = "text/html;profile=mcp-app";
export const BUILD_MATES_UI_ACTION_TOOLS = BUILD_MATES_CHAT_ACTION_TOOL_NAMES;

export type BuildmatesWorkspaceView =
  | "home"
  | "account"
  | "profile"
  | "introductions"
  | "projects"
  | "project"
  | "project_details"
  | "connections"
  | "connection"
  | "room"
  | "room_enhancements"
  | "circles"
  | "circle"
  | "circle_messages"
  | "activity"
  | "blocked"
  | "sources"
  | "signals"
  | "moderation"
  | "project_collaborators"
  | "privacy";

export type BuildmatesChatUiAction = {
  id: string;
  label: string;
  tool: (typeof BUILD_MATES_UI_ACTION_TOOLS)[number];
  input: Record<string, unknown>;
  tone?: "primary" | "secondary" | "danger";
  confirmation?: string;
  disabled?: boolean;
};

export type BuildmatesWorkspaceSnapshot = {
  view: BuildmatesWorkspaceView;
  title?: string;
  subtitle?: string;
  subjectId?: string;
  data?: unknown;
  actions?: BuildmatesChatUiAction[];
};

export type BuildmatesChatUiResource = {
  uri: string;
  mimeType: typeof BUILD_MATES_UI_MIME_TYPE;
  text: string;
  _meta: {
    ui: {
      prefersBorder: boolean;
      csp: {
        connectDomains: string[];
        resourceDomains: string[];
        frameDomains: string[];
      };
    };
    "openai/ui": {
      availableDisplayModes: ["inline"];
    };
  };
};

/**
 * Metadata to spread into a tool's `_meta` field. Keep the compatibility alias
 * while MCP Apps hosts converge on `ui.resourceUri`.
 */
export function buildmatesChatUiToolMeta(): Record<string, unknown> {
  return {
    ui: { resourceUri: BUILD_MATES_UI_RESOURCE_URI },
    "openai/outputTemplate": BUILD_MATES_UI_RESOURCE_URI,
  };
}

export function buildmatesChatUiResource(): BuildmatesChatUiResource {
  return {
    uri: BUILD_MATES_UI_RESOURCE_URI,
    mimeType: BUILD_MATES_UI_MIME_TYPE,
    text: BUILD_MATES_CHAT_UI_HTML,
    _meta: {
      ui: {
        prefersBorder: true,
        csp: {
          connectDomains: [],
          resourceDomains: [],
          frameDomains: [],
        },
      },
      "openai/ui": {
        availableDisplayModes: ["inline"],
      },
    },
  };
}

/** Register the single portable MCP Apps resource once per MCP server. */
export function registerBuildmatesChatUi(server: McpServer) {
  const resource = buildmatesChatUiResource();
  return server.registerResource(
    "buildmates-workspace-ui",
    BUILD_MATES_UI_RESOURCE_URI,
    {
      title: "Buildmates workspace",
      description: "A compact interactive view of the authenticated Buildmates workspace.",
      mimeType: BUILD_MATES_UI_MIME_TYPE,
    },
    async () => ({ contents: [resource] }),
  );
}

export { BUILD_MATES_CHAT_UI_HTML } from "./chat-ui/widget";
