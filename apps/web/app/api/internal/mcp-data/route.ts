import { verifyDelegatedRequest } from "@/src/platform/delegated-request";
import { getPlatformBindings } from "@/src/platform/bindings";
import { completeIdentityLink, createD1IdentityLinkStore } from "@/src/platform/identity-link-store";
import { BUILD_MATES_MCP_TOOLS, canonicalToolInputHash, createD1McpProductRepository, executeBuildmatesTool, pruneExpiredAssertionReplays } from "@buildmates/mcp-core";
import { recordTrustedAutomationCapability } from "@/src/platform/onboarding-data";
import { getMcpCandidateShortlist, recordMcpCandidateEvaluation, recordMcpManualMatchResponse } from "@/src/matching/mcp-adapter";
import { createSurfaceAssetUploadGrant } from "@/src/platform/surface-upload-grants";
import { associateProfileProjectMedia, loadSurfacePreviewAssets } from "@/src/platform/surface-assets";
import { performChatAction, readChatWorkspace } from "@/src/platform/chat-operations";
import { proposeRoomUpgrade, respondRoomUpgrade } from "@/src/rooms/lifecycle";
import { createCircleProposal } from "@/src/circles/service";

const ALLOWED_ACTIONS = {
  "identity.link-status.read": "identity:link-status:read",
  "identity.link.complete": "identity:link:complete",
} as const;

export async function POST(request: Request) {
  if (process.env.MCP_TOPOLOGY !== "external") return Response.json({ error: "not_found" }, { status: 404 });
  const publicKeyPem = process.env.MCP_DELEGATION_PUBLIC_KEY_PEM;
  if (!publicKeyPem) return Response.json({ error: "delegation_not_configured" }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  if (containsUserId(body)) return Response.json({ error: "caller_user_id_forbidden" }, { status: 400 });
  const action = readString(body, "action");
  const toolName = readString(body, "tool");
  const toolInput = body && typeof body === "object" ? (body as Record<string, unknown>).input : null;
  const isTool = Boolean(toolName && action === `tool.execute:${toolName}` && BUILD_MATES_MCP_TOOLS.includes(toolName));
  const expectedScope = isTool ? `mcp:tool:${toolName}` : action && ALLOWED_ACTIONS[action as keyof typeof ALLOWED_ACTIONS];
  if (!action || !expectedScope) return Response.json({ error: "unsupported_action" }, { status: 400 });
  if (isTool && (!toolInput || typeof toolInput !== "object")) return Response.json({ error: "invalid_tool_request" }, { status: 400 });
  const expectedInputHash = isTool ? await canonicalToolInputHash(toolInput) : undefined;

  try {
    const { DB, ASSETS } = await getPlatformBindings();
    const claims = await verifyDelegatedRequest({
      authorization: request.headers.get("authorization"),
      publicKeyPem,
      issuer: process.env.MCP_DELEGATION_ISSUER || "buildmates-mcp",
      audience: process.env.MCP_DELEGATION_AUDIENCE || "buildmates-web-data",
      expectedAction: action,
      expectedScope,
      expectedTool: isTool ? toolName! : undefined,
      expectedInputHash,
      consumeReplay: async ({ jti, iss, sub, action, exp }) => {
        try {
          await pruneExpiredAssertionReplays(DB, Date.now());
          await DB.prepare(
            "INSERT INTO assertion_replays (jti, issuer, subject, action, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          ).bind(jti, iss, sub, action, exp * 1000, Date.now()).run();
          return true;
        } catch { return false; }
      },
    });
    if (action === "identity.link.complete") {
      return completeIdentityLinkResponse(DB, body, claims.sub);
    }
    if (isTool) {
      try {
        const value = await executeBuildmatesTool(toolName!, toolInput, claims.sub, {
          linkBaseUrl: new URL(request.url).origin,
          repository: createD1McpProductRepository(DB),
          completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }),
          allowAttempt: async () => false,
          resolveLinkedUser: async ({ mcpSubject, workspaceScope }) => {
            const link = await DB.prepare("SELECT l.user_id AS userId FROM identity_links l JOIN users u ON u.id=l.user_id AND u.status='active' WHERE l.provider_channel = 'mcp' AND l.provider_issuer = 'buildmates_mcp' AND l.provider_subject = ? AND l.workspace_scope = ? AND l.revoked_at IS NULL LIMIT 1").bind(mcpSubject, workspaceScope).first<{ userId: string }>();
            return link ?? null;
          },
          validateTaxonomy: (input) => validateTaxonomy(DB, input),
          recordAutomationCapabilityProof: async ({ userId, now }) => {
            const checkedAt = Date.parse(now);
            await recordTrustedAutomationCapability(DB, userId, "approval_required", checkedAt);
            return {
              capability: "approval_required" as const,
              checkedAt: new Date(checkedAt).toISOString(),
              expiresAt: null,
            };
          },
          getCandidateShortlist: (input) => getMcpCandidateShortlist(DB, input),
          recordCandidateEvaluation: (input) => recordMcpCandidateEvaluation(DB, input),
          recordManualMatchResponse: (input) => recordMcpManualMatchResponse(DB, input),
          createSurfaceAssetUploadGrant: (input) => createSurfaceAssetUploadGrant(DB, new URL(request.url).origin, input),
          attachProfileProjectMedia: (input) => associateProfileProjectMedia({ DB, actorId: input.userId, assetId: input.assetId, projectKey: input.projectKey, projectTitle: input.projectTitle, altText: input.altText, at: new Date(input.now) }),
          proposeRoomUpgrade: async (input) => {
            const result = await proposeRoomUpgrade(DB, { roomId: input.roomId, userId: input.userId, proposalId: input.proposalId, modules: input.modules, explanation: input.explanation, title: input.title, appearance: input.appearance, now: Date.parse(input.now) });
            return { proposalId: result.id, status: result.status };
          },
          respondRoomUpgrade: async (input) => {
            const result = await respondRoomUpgrade(DB, { roomId: input.roomId, proposalId: input.proposalId, userId: input.userId, response: input.response, now: Date.parse(input.now) });
            return { proposalId: result.id, status: result.status };
          },
          loadSurfacePreviewAssets: (input) => loadSurfacePreviewAssets({ DB, bucket: ASSETS, userId: input.userId, surfaceId: input.surfaceId, sources: input.sources }),
          readChatWorkspace: (input) => readChatWorkspace(DB, input),
          performChatAction: (input) => performChatAction(DB, input, ASSETS),
          proposeCircleModule: async (input) => {
            const result = await createCircleProposal(DB, { actorId: input.userId, circleId: input.circleId, kind: "module", payload: { kind: input.kind, config: { title: input.title, appearance: input.appearance } }, now: Date.parse(input.now) });
            return { proposalId: result.id, status: result.status };
          },
        });
        return Response.json({ value }, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "tool_failed";
        console.warn(JSON.stringify({ event: "delegated_mcp_tool_failed", tool: toolName, message }));
        const status = message === "identity_link_required" ? 403 : message.includes("not_authorized") ? 404 : 400;
        return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
      }
    }
    const link = await DB.prepare(
      "SELECT l.id FROM identity_links l JOIN users u ON u.id=l.user_id AND u.status='active' WHERE l.provider_channel = 'mcp' AND l.provider_issuer = 'buildmates_mcp' AND l.provider_subject = ? AND l.workspace_scope = 'global' AND l.revoked_at IS NULL LIMIT 1",
    ).bind(claims.sub).first<{ id: string }>();
    if (!link) return Response.json({ error: "identity_link_required" }, { status: 403 });
    return Response.json({ linked: true, action: claims.action }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "invalid_delegated_request" }, { status: 401 });
  }
}

async function validateTaxonomy(DB: D1Database, input: { taxonomyVersion: string; topicIds: string[]; toolIds: string[]; domainIds: string[]; stageIds: string[]; collaborationIntentIds: string[] }): Promise<boolean> {
  const version = await DB.prepare("SELECT id FROM taxonomy_versions WHERE id = ? OR CAST(version AS TEXT) = ? LIMIT 1").bind(input.taxonomyVersion, input.taxonomyVersion).first<{ id: string }>();
  if (!version) return false;
  const groups: Array<[string, string[]]> = [["topics", input.topicIds], ["tools", input.toolIds], ["domains", input.domainIds], ["stages", input.stageIds], ["collaboration_intents", input.collaborationIntentIds]];
  for (const [table, ids] of groups) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) continue;
    if (uniqueIds.length > 30) return false;
    const placeholders = uniqueIds.map(() => "?").join(",");
    const rows = await DB.prepare(`SELECT id FROM ${table} WHERE taxonomy_version_id = ? AND id IN (${placeholders}) LIMIT 30`).bind(version.id, ...uniqueIds).all<{ id: string }>();
    if (rows.results.length !== uniqueIds.length) return false;
  }
  return true;
}

async function completeIdentityLinkResponse(DB: D1Database, body: unknown, mcpSubject: string): Promise<Response> {
  const code = readString(body, "code")?.trim().toUpperCase();
  const workspaceScope = readString(body, "workspaceScope")?.trim() || "global";
  if (workspaceScope !== "global") return Response.json({ error: "invalid_workspace_scope" }, { status: 400 });
  if (!code) {
    return Response.json({ linked: false, reason: "invalid_or_expired" }, { status: 400 });
  }
  const result = await completeIdentityLink(createD1IdentityLinkStore(DB), { code, workspaceScope, mcpSubject });
  return Response.json(
    result.linked ? { linked: true } : result,
    { status: result.linked ? 200 : result.reason === "conflict" ? 409 : 400, headers: { "cache-control": "no-store" } },
  );
}

function containsUserId(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => key.toLowerCase() === "userid" || containsUserId(child));
}

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}
