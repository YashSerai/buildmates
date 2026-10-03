import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Miniflare } from "miniflare";
import { createBuildmatesMcpServer, createD1McpProductRepository, type BuildmatesToolServices } from "@buildmates/mcp-core";
import { getMcpCandidateShortlist, recordMcpCandidateEvaluation, recordMcpManualMatchResponse } from "../../apps/web/src/matching/mcp-adapter";
import { readChatWorkspace, performChatAction } from "../../apps/web/src/platform/chat-operations";
import { completeIdentityLink, createD1IdentityLinkStore } from "../../apps/web/src/platform/identity-link-store";
import { EvidenceStdioTransport, bounded, writeJsonAtomic } from "./conversation-transport";
import { applyD1Migrations } from "./d1";
import {
  ALICE_ID, BOB_ID, CAROL_ID, QA_NOW, QA_NOW_MS, QA_SUBJECT, normalizeScenario,
  isLinkedScenario, seedConversationFixture, readMeta, writeMeta,
} from "./conversation-fixture";

const scenario = normalizeScenario(process.env.BUILDMATES_QA_SCENARIO ?? process.env.QA_SCENARIO);
const evidenceDir = resolve(process.env.QA_EVIDENCE_DIR ?? ".qa-evidence/buildmates-conversation");
const d1Persist = join(evidenceDir, "d1");
const snapshotPath = join(evidenceDir, "snapshot.json");
const contractPath = join(evidenceDir, "contract.json");

if (!Number.isFinite(QA_NOW_MS)) throw new Error(`Invalid QA clock: ${QA_NOW}`);

type CountRow = { count: number | string };
type SnapshotMessage = { sequence?: number; direction?: string; message?: unknown };

async function count(DB: D1Database, table: string, where = "", ...args: unknown[]) {
  const row = await DB.prepare(`SELECT COUNT(*) AS count FROM ${table}${where}`).bind(...args).first<CountRow>();
  return Number(row?.count ?? 0);
}

async function readSnapshotState(DB: D1Database) {
  const [users, profiles, profileFields, projects, collaborators, proposals, circleProposals, connections, rooms, circles, circleMembers, messages, circleMessages, setup, sources, automation, pulses, surfaces, revisions, idempotency, exports, uncertain] = await Promise.all([
    DB.prepare(`SELECT id,status,data_origin AS dataOrigin FROM users WHERE id LIKE 'qa_synthetic_%' ORDER BY id`).all(),
    DB.prepare(`SELECT id,user_id AS userId,display_name AS displayName,summary,project_or_interest AS projectOrInterest,portfolio_links_json AS portfolioLinks,audience,allow_matching AS allowMatching,acceptance_mode AS acceptanceMode,indexable,coarse_location AS coarseLocation,location_map_opt_in AS locationMapOptIn,timezone,published_at AS publishedAt,updated_at AS updatedAt FROM profiles WHERE user_id LIKE 'qa_synthetic_%' ORDER BY user_id`).all(),
    DB.prepare(`SELECT profile_id AS profileId,field_key AS fieldKey,value_json AS valueJson,audience,allow_matching AS allowMatching,source_status AS sourceStatus,provenance,updated_at AS updatedAt FROM profile_fields WHERE profile_id IN (SELECT id FROM profiles WHERE user_id LIKE 'qa_synthetic_%') ORDER BY profile_id,fieldKey`).all(),
    DB.prepare(`SELECT id,owner_user_id AS ownerUserId,slug,title,summary,audience,allow_matching AS allowMatching,status,stage,indexable,published_at AS publishedAt,updated_at AS updatedAt FROM projects WHERE owner_user_id LIKE 'qa_synthetic_%' ORDER BY owner_user_id,slug`).all(),
    DB.prepare(`SELECT project_id AS projectId,user_id AS userId,role,approved_at AS approvedAt FROM project_collaborators WHERE user_id LIKE 'qa_synthetic_%' ORDER BY project_id,user_id`).all(),
    DB.prepare(`SELECT id,match_pair_id AS matchPairId,state,expires_at AS expiresAt,terminal_at AS terminalAt FROM match_proposals WHERE match_pair_id LIKE 'qa_%' ORDER BY id`).all(),
    DB.prepare(`SELECT p.id,p.circle_id AS circleId,p.proposer_user_id AS proposerUserId,p.kind,p.status,p.governance_version AS governanceVersion,p.created_at AS createdAt FROM circle_proposals p WHERE p.proposer_user_id LIKE 'qa_synthetic_%' OR EXISTS (SELECT 1 FROM circle_memberships m WHERE m.circle_id=p.circle_id AND m.user_id LIKE 'qa_synthetic_%') ORDER BY p.created_at,p.id`).all(),
    DB.prepare(`SELECT id,match_pair_id AS matchPairId,state,updated_at AS updatedAt FROM connections WHERE match_pair_id IN (SELECT id FROM match_pairs WHERE user_a_id LIKE 'qa_synthetic_%' OR user_b_id LIKE 'qa_synthetic_%') ORDER BY id`).all(),
    DB.prepare(`SELECT id,connection_id AS connectionId,status,updated_at AS updatedAt FROM rooms WHERE connection_id IN (SELECT c.id FROM connections c JOIN match_pairs p ON p.id=c.match_pair_id WHERE p.user_a_id LIKE 'qa_synthetic_%' OR p.user_b_id LIKE 'qa_synthetic_%') ORDER BY id`).all(),
    DB.prepare(`SELECT c.id,c.name,c.status,c.governance_mode AS governanceMode,c.updated_at AS updatedAt FROM circles c WHERE EXISTS (SELECT 1 FROM circle_memberships m WHERE m.circle_id=c.id AND m.user_id LIKE 'qa_synthetic_%') ORDER BY c.id`).all(),
    DB.prepare(`SELECT circle_id AS circleId,user_id AS userId,role,status,joined_at AS joinedAt FROM circle_memberships WHERE user_id LIKE 'qa_synthetic_%' ORDER BY circle_id,user_id`).all(),
    DB.prepare(`SELECT id,room_id AS roomId,sender_user_id AS senderUserId,client_message_id AS clientMessageId,body,LENGTH(body) AS bodyLength,edited_at AS editedAt,deleted_at AS deletedAt,created_at AS createdAt FROM messages WHERE sender_user_id LIKE 'qa_synthetic_%' OR room_id IN (SELECT r.id FROM rooms r JOIN connections c ON c.id=r.connection_id JOIN match_pairs p ON p.id=c.match_pair_id WHERE p.user_a_id LIKE 'qa_synthetic_%' OR p.user_b_id LIKE 'qa_synthetic_%') ORDER BY created_at,id LIMIT 140`).all(),
    DB.prepare(`SELECT id,circle_id AS circleId,sender_user_id AS senderUserId,client_message_id AS clientMessageId,body,LENGTH(body) AS bodyLength,edited_at AS editedAt,deleted_at AS deletedAt,created_at AS createdAt FROM circle_messages WHERE sender_user_id LIKE 'qa_synthetic_%' OR EXISTS (SELECT 1 FROM circle_memberships m WHERE m.circle_id=circle_messages.circle_id AND m.user_id LIKE 'qa_synthetic_%') ORDER BY created_at,id`).all(),
    DB.prepare(`SELECT user_id AS userId,completed_steps_json AS completedStepsJson,updated_at AS updatedAt FROM setup_states WHERE user_id LIKE 'qa_synthetic_%'`).all(),
    DB.prepare(`SELECT app_id AS appId,display_name AS displayName,category,access_mode AS accessMode,last_reviewed_at AS lastReviewedAt FROM connected_app_preferences WHERE user_id LIKE 'qa_synthetic_%' ORDER BY app_id`).all(),
    DB.prepare(`SELECT user_id AS userId,kind,cursor,last_success_at AS lastSuccessAt,next_run_at AS nextRunAt,state_json AS stateJson,updated_at AS updatedAt FROM automation_checkpoints WHERE user_id LIKE 'qa_synthetic_%' ORDER BY kind`).all(),
    DB.prepare(`SELECT id,user_id AS userId,intent_summary AS intentSummary,similar_adjacent AS similarAdjacent,local_global AS localGlobal,serendipity,starts_at AS startsAt,expires_at AS expiresAt,controls_json AS controlsJson FROM networking_pulses WHERE user_id LIKE 'qa_synthetic_%' ORDER BY id`).all(),
    DB.prepare(`SELECT id,owner_user_id AS ownerUserId,kind,subject_id AS subjectId,published_revision_id AS publishedRevisionId,updated_at AS updatedAt FROM surfaces WHERE owner_user_id LIKE 'qa_synthetic_%' ORDER BY id`).all(),
    DB.prepare(`SELECT id,surface_id AS surfaceId,revision_number AS revisionNumber,author_user_id AS authorUserId,status,visibility,LENGTH(spec_json) AS specLength,created_at AS createdAt FROM surface_revisions WHERE author_user_id LIKE 'qa_synthetic_%' ORDER BY surface_id,revision_number`).all(),
    DB.prepare(`SELECT id,actor_user_id AS actorUserId,operation,status,expires_at AS expiresAt,updated_at AS updatedAt FROM idempotency_keys WHERE actor_user_id LIKE 'qa_synthetic_%' ORDER BY updated_at DESC,id LIMIT 40`).all(),
    DB.prepare(`SELECT id,status,object_key AS objectKey,expires_at AS expiresAt,created_at AS createdAt,updated_at AS updatedAt FROM export_jobs WHERE user_id LIKE 'qa_synthetic_%' ORDER BY updated_at DESC,id`).all(),
    DB.prepare(`SELECT value FROM qa_conversation_meta WHERE key='uncertain_save_project_committed'`).first<{ value: string }>(),
  ]);
  const [userCount, profileCount, projectCount, messageCount, circleCount, exportCount] = await Promise.all([
    count(DB, "users", " WHERE id LIKE 'qa_synthetic_%'"),
    count(DB, "profiles", " WHERE user_id LIKE 'qa_synthetic_%'"),
    count(DB, "projects", " WHERE owner_user_id LIKE 'qa_synthetic_%'"),
    count(DB, "messages", " WHERE sender_user_id LIKE 'qa_synthetic_%' OR room_id IN (SELECT r.id FROM rooms r JOIN connections c ON c.id=r.connection_id JOIN match_pairs p ON p.id=c.match_pair_id WHERE p.user_a_id LIKE 'qa_synthetic_%' OR p.user_b_id LIKE 'qa_synthetic_%')"),
    count(DB, "circles", " WHERE EXISTS (SELECT 1 FROM circle_memberships m WHERE m.circle_id=circles.id AND m.user_id LIKE 'qa_synthetic_%')"),
    count(DB, "export_jobs", " WHERE user_id LIKE 'qa_synthetic_%'"),
  ]);
  return {
    users: users.results,
    profiles: profiles.results,
    profileFields: profileFields.results,
    projects: projects.results,
    projectCollaborators: collaborators.results,
    proposals: proposals.results,
    circleProposals: circleProposals.results,
    connections: connections.results,
    rooms: rooms.results,
    circles: circles.results,
    circleMembers: circleMembers.results,
    messages: messages.results,
    circleMessages: circleMessages.results,
    setup: setup.results,
    sources: sources.results,
    automation: automation.results,
    pulses: pulses.results,
    surfaces: surfaces.results,
    revisions: revisions.results,
    idempotency: idempotency.results,
    exports: exports.results,
    uncertainSaveProjectCommitted: uncertain?.value === "true",
    counts: {
      users: userCount,
      profiles: profileCount,
      projects: projectCount,
      messages: messageCount,
      circles: circleCount,
      exports: exportCount,
    },
  };
}

let lastSnapshot: SnapshotMessage | undefined;
async function writeSnapshot(DB: D1Database, extra: Record<string, unknown> = {}) {
  const state = await readSnapshotState(DB);
  const payload = {
    version: 1,
    syntheticOnly: true,
    scenario,
    fixedNow: QA_NOW,
    subject: QA_SUBJECT,
    actor: { userId: ALICE_ID, displayName: "Alice Synthetic QA", handle: "alice_synthetic" },
    collaborators: [
      { userId: BOB_ID, displayName: "Bob Synthetic QA", handle: "bob_synthetic" },
      { userId: CAROL_ID, displayName: "Carol Synthetic QA", handle: "carol_synthetic" },
    ],
    lastMessage: bounded(lastSnapshot, 0),
    ...state,
    ...extra,
  };
  await writeJsonAtomic(snapshotPath, payload);
  const sequence = typeof lastSnapshot?.sequence === "number" ? lastSnapshot.sequence : null;
  if (sequence !== null && lastSnapshot?.direction === "outgoing") await writeJsonAtomic(join(evidenceDir, `state-${sequence}.json`), payload);
}

async function validateTaxonomy(input: { taxonomyVersion: string; topicIds: string[]; toolIds: string[]; domainIds: string[]; stageIds: string[]; collaborationIntentIds: string[] }, DB: D1Database) {
  const version = await DB.prepare(`SELECT id,version FROM taxonomy_versions WHERE status='active' AND (id=? OR CAST(version AS TEXT)=?) ORDER BY version DESC LIMIT 1`).bind(input.taxonomyVersion, input.taxonomyVersion).first<{ id: string; version: number }>();
  if (!version) return false;
  const checks: Array<[string, string[]]> = [["topics", input.topicIds], ["tools", input.toolIds], ["domains", input.domainIds], ["stages", input.stageIds], ["collaboration_intents", input.collaborationIntentIds]];
  for (const [table, ids] of checks) {
    if (!ids.length) continue;
    const rows = await DB.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")}) AND taxonomy_version_id=?`).bind(...ids, version.id).first<CountRow>();
    if (Number(rows?.count ?? 0) !== ids.length) return false;
  }
  return true;
}

async function resolveLinkedUser(DB: D1Database, subject: string) {
  const row = await DB.prepare(`SELECT l.user_id AS userId FROM identity_links l JOIN identity_principals p ON p.id=l.principal_id JOIN users u ON u.id=l.user_id
    WHERE p.channel='mcp' AND p.issuer='buildmates_mcp' AND p.subject=? AND p.workspace_scope='global' AND p.revoked_at IS NULL AND l.revoked_at IS NULL AND u.status='active' LIMIT 1`).bind(subject).first<{ userId: string }>();
  return row ? { userId: row.userId } : null;
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], d1Persist, compatibilityDate: "2026-05-22" });
  const DB = await mf.getD1Database("DB") as D1Database;
  let migrated = false;
  const hasUsers = await DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1`).first();
  if (!hasUsers) {
    await applyD1Migrations(DB);
    migrated = true;
  }
  const seeded = await seedConversationFixture(DB, scenario);
  const identityStore = createD1IdentityLinkStore(DB);
  const repository = createD1McpProductRepository(DB);
  let uncertainInjected = scenario === "uncertain" && (await readMeta(DB, "uncertain_save_project_committed")) === "true";
  const services: BuildmatesToolServices = {
    linkBaseUrl: "https://buildmates.example",
    repository,
    completeIdentityLink: async ({ mcpSubject, code, workspaceScope }) => completeIdentityLink(identityStore, { mcpSubject, code, workspaceScope, now: QA_NOW_MS }).then((result) => result.linked ? { linked: true } : result),
    allowAttempt: async () => true,
    resolveLinkedUser: async ({ mcpSubject }) => resolveLinkedUser(DB, mcpSubject),
    validateTaxonomy: async (input) => validateTaxonomy(input, DB),
    recordAutomationCapabilityProof: async () => ({ capability: "approval_required", checkedAt: QA_NOW, expiresAt: new Date(QA_NOW_MS + 15 * 60_000).toISOString() }),
    getCandidateShortlist: async (input) => getMcpCandidateShortlist(DB, input),
    recordCandidateEvaluation: async (input) => recordMcpCandidateEvaluation(DB, input),
    recordManualMatchResponse: async (input) => recordMcpManualMatchResponse(DB, input),
    readChatWorkspace: async (input) => readChatWorkspace(DB, input),
    performChatAction: async (input) => {
      if (scenario === "uncertain" && !uncertainInjected && input.action.kind === "save_project") {
        const result = await performChatAction(DB, input);
        uncertainInjected = true;
        await writeMeta(DB, "uncertain_save_project_committed", "true");
        await writeSnapshot(DB, { faultInjection: "unknown_after_commit", committedResult: bounded(result, 10) });
        throw new Error("qa_unknown_after_commit");
      }
      return performChatAction(DB, input);
    },
    now: () => new Date(QA_NOW),
  };
  await writeJsonAtomic(contractPath, {
    version: 1,
    syntheticOnly: true,
    scenario,
    fixedNow: QA_NOW,
    subject: QA_SUBJECT,
    actor: { userId: ALICE_ID, displayName: "Alice Synthetic QA", handle: "alice_synthetic" },
    collaborators: [BOB_ID, CAROL_ID],
    d1Persist,
    seeded,
    migrated,
    prelink: { enabled: !isLinkedScenario(scenario), linkCodeEnv: "BUILDMATES_QA_LINK_CODE or QA_LINK_CODE", codeValue: "[redacted]" },
    faultInjection: scenario === "uncertain" ? "First save_project commits through the real adapter then returns qa_unknown_after_commit once; retry evidence remains durable." : null,
    boundaries: ["No production network or account credentials are used.", "All identities and content use qa_synthetic_* identifiers.", "stdout is reserved for MCP JSON-RPC; evidence is written under QA_EVIDENCE_DIR."],
  });
  await writeSnapshot(DB, { startup: true });
  process.stderr.write(`[buildmates-qa] scenario=${scenario} fixedNow=${QA_NOW} evidence=${evidenceDir} d1Persist=${d1Persist}\n`);

  const transport = new EvidenceStdioTransport(evidenceDir, async (line) => {
    lastSnapshot = line as SnapshotMessage;
    await writeSnapshot(DB);
  }, { authInfo: { token: "qa-synthetic-token", clientId: "buildmates-qa-client", scopes: ["buildmates:full"], extra: { mcp_sub: QA_SUBJECT } } });
  const server = createBuildmatesMcpServer(services);
  await server.connect(transport);
  const close = async () => {
    await writeSnapshot(DB, { shutdown: true });
    await mf.dispose();
  };
  process.once("SIGINT", () => void close().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void close().finally(() => process.exit(0)));
}

main().catch((error) => {
  process.stderr.write(`[buildmates-qa] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
