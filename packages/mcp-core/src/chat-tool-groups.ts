import { z } from "zod";
import { chatActionSchema, type ChatAction } from "./chat-operations";
import { idempotencyKeySchema, workspaceScopeSchema } from "./schemas";

export type ChatActionKind = ChatAction["kind"];

export const BUILD_MATES_CHAT_ACTION_TOOL_NAMES = [
  "perform_buildmates_action",
  "perform_buildmates_project_action",
  "perform_buildmates_relationship_action",
  "perform_buildmates_circle_action",
] as const;

export type BuildmatesChatActionToolName = (typeof BUILD_MATES_CHAT_ACTION_TOOL_NAMES)[number];

const CORE_ACTION_KINDS = [
  "save_profile",
  "publish_profile",
  "hide_profile",
  "mark_activity_read",
  "block_user",
  "unblock_user",
  "report_target",
  "appeal_moderation_case",
  "revoke_connected_app",
  "update_work_signal",
  "delete_work_signal",
  "pause_matching",
  "resume_matching",
  "disable_autopilot",
  "disconnect_all",
  "redact_shared_context",
  "request_export",
  "prepare_account_deletion",
  "request_deletion",
] as const satisfies readonly ChatActionKind[];

const PROJECT_ACTION_KINDS = [
  "save_project",
  "archive_project",
  "restore_project",
  "delete_project",
  "invite_project_collaborator",
  "respond_project_collaboration",
  "remove_project_collaborator",
  "transfer_project_ownership",
  "accept_invite",
  "publish_project_update",
] as const satisfies readonly ChatActionKind[];

const RELATIONSHIP_ACTION_KINDS = [
  "send_room_message",
  "edit_room_message",
  "delete_room_message",
  "mark_room_read",
  "set_connection_preference",
  "save_connection_note",
  "end_connection",
  "schedule_connection_reminder",
  "dismiss_connection_reminder",
  "request_reconnect",
  "respond_reconnect",
  "acknowledge_renewed_relevance",
  "save_introduction_feedback",
  "propose_room_upgrade",
  "respond_room_upgrade",
  "add_room_module_entry",
  "update_room_module_entry",
  "delete_room_module_entry",
  "save_availability",
  "withdraw_availability",
  "propose_meeting",
  "respond_meeting",
] as const satisfies readonly ChatActionKind[];

const CIRCLE_ACTION_KINDS = [
  "create_circle",
  "invite_circle_member",
  "respond_circle_invite",
  "create_circle_proposal",
  "send_circle_message",
  "edit_circle_message",
  "delete_circle_message",
  "vote_circle_proposal",
  "publish_circle_proposal",
  "leave_circle",
  "manage_circle_member",
  "add_circle_module_entry",
  "update_circle_module_entry",
  "delete_circle_module_entry",
] as const satisfies readonly ChatActionKind[];

const GROUP_KINDS = {
  perform_buildmates_action: CORE_ACTION_KINDS,
  perform_buildmates_project_action: PROJECT_ACTION_KINDS,
  perform_buildmates_relationship_action: RELATIONSHIP_ACTION_KINDS,
  perform_buildmates_circle_action: CIRCLE_ACTION_KINDS,
} as const satisfies Record<BuildmatesChatActionToolName, readonly ChatActionKind[]>;

const ALL_GROUPED_KINDS = Object.values(GROUP_KINDS).flat() as readonly ChatActionKind[];
const GROUPED_KINDS = new Set<ChatActionKind>(ALL_GROUPED_KINDS);
if (GROUPED_KINDS.size !== ALL_GROUPED_KINDS.length) throw new Error("duplicate_chat_action_group_kind");

type ActionSchema = z.ZodObject<z.ZodRawShape>;

function isChatActionKind(value: unknown): value is ChatActionKind {
  return typeof value === "string" && (ALL_GROUPED_KINDS as readonly string[]).includes(value);
}

function schemaKind(option: ActionSchema): ChatActionKind {
  const generated = z.toJSONSchema(option) as { properties?: { kind?: { const?: unknown } } };
  const kind = generated.properties?.kind?.const;
  if (!isChatActionKind(kind)) throw new Error("unknown_chat_action_schema_kind");
  return kind;
}

const actionOptions = [...chatActionSchema.options] as readonly ActionSchema[];
const actionOptionsByKind = new Map<ChatActionKind, ActionSchema>();
for (const option of actionOptions) {
  const kind = schemaKind(option);
  if (actionOptionsByKind.has(kind)) throw new Error("duplicate_chat_action_schema_kind");
  actionOptionsByKind.set(kind, option);
}
if (actionOptionsByKind.size !== GROUPED_KINDS.size) throw new Error("unassigned_chat_action_schema_kind");

function groupSchema(kinds: readonly ChatActionKind[]) {
  const options = kinds.map((kind) => actionOptionsByKind.get(kind));
  if (options.some((option): option is undefined => !option)) throw new Error("missing_chat_action_schema_kind");
  const unionOptions = options as [ActionSchema, ...ActionSchema[]];
  return z.object({
    action: z.discriminatedUnion("kind", unionOptions),
    idempotencyKey: idempotencyKeySchema,
    workspaceScope: workspaceScopeSchema,
  }).strict();
}

export type BuildmatesChatToolGroup = {
  name: BuildmatesChatActionToolName;
  title: string;
  description: string;
  schema: z.ZodType;
  kinds: readonly ChatActionKind[];
};

export const buildmatesChatToolGroups = [
  {
    name: "perform_buildmates_action",
    title: "Manage profile, privacy and data export",
    description: "Updates profiles, privacy, Work Signals, activity and safety. Exports account data with action.kind request_export: follow every returned section cursor and report oversized sections as incomplete. Prepares account deletion with prepare_account_deletion; request_deletion separately requires DELETE BUILDMATES. Saving an already published profile changes its visible fields immediately; obtain approval for public edits and preserve unrelated fields and statistics. Use permitted Work Signals for matching-only refreshes.",
    schema: groupSchema(CORE_ACTION_KINDS),
    kinds: CORE_ACTION_KINDS,
  },
  {
    name: "perform_buildmates_project_action",
    title: "Manage a Buildmates project",
    description: "Creates and updates your Buildmates projects, invites collaborators, and handles project invitations after you review the action.",
    schema: groupSchema(PROJECT_ACTION_KINDS),
    kinds: PROJECT_ACTION_KINDS,
  },
  {
    name: "perform_buildmates_relationship_action",
    title: "Manage a Buildmates connection",
    description: "Sends and manages room messages, connection preferences, reminders, reconnection, availability, meetings, and shared room modules after you review the action.",
    schema: groupSchema(RELATIONSHIP_ACTION_KINDS),
    kinds: RELATIONSHIP_ACTION_KINDS,
  },
  {
    name: "perform_buildmates_circle_action",
    title: "Manage a Buildmates Circle",
    description: "Manages Circle members, messages, proposals, votes and shared modules after review. create_circle_proposal with proposalKind module uses payload {kind: resource_shelf|experiment_tracker|decision_log|feedback_queue|milestone_tracker|scoreboard, config: {title}}; a standard tool proposal needs no generated visual concept. Custom appearance needs reviewed design direction. proposalKind request uses payload {change,outcome} and records an intention that cannot be published. Rules use {moduleId,rules:{title,description}}. Creation does not vote or publish; read the actual governance state before those separate approved actions.",
    schema: groupSchema(CIRCLE_ACTION_KINDS),
    kinds: CIRCLE_ACTION_KINDS,
  },
] as const satisfies readonly BuildmatesChatToolGroup[];

export function buildmatesChatActionToolName(kind: ChatActionKind): BuildmatesChatActionToolName {
  switch (kind) {
    case "save_profile":
    case "publish_profile":
    case "hide_profile":
    case "mark_activity_read":
    case "block_user":
    case "unblock_user":
    case "report_target":
    case "appeal_moderation_case":
    case "revoke_connected_app":
    case "update_work_signal":
    case "delete_work_signal":
    case "pause_matching":
    case "resume_matching":
    case "disable_autopilot":
    case "disconnect_all":
    case "redact_shared_context":
    case "request_export":
    case "prepare_account_deletion":
    case "request_deletion":
      return "perform_buildmates_action";
    case "save_project":
    case "archive_project":
    case "restore_project":
    case "delete_project":
    case "invite_project_collaborator":
    case "respond_project_collaboration":
    case "remove_project_collaborator":
    case "transfer_project_ownership":
    case "accept_invite":
    case "publish_project_update":
      return "perform_buildmates_project_action";
    case "send_room_message":
    case "edit_room_message":
    case "delete_room_message":
    case "mark_room_read":
    case "set_connection_preference":
    case "save_connection_note":
    case "end_connection":
    case "schedule_connection_reminder":
    case "dismiss_connection_reminder":
    case "request_reconnect":
    case "respond_reconnect":
    case "acknowledge_renewed_relevance":
    case "save_introduction_feedback":
    case "propose_room_upgrade":
    case "respond_room_upgrade":
    case "add_room_module_entry":
    case "update_room_module_entry":
    case "delete_room_module_entry":
    case "save_availability":
    case "withdraw_availability":
    case "propose_meeting":
    case "respond_meeting":
      return "perform_buildmates_relationship_action";
    case "create_circle":
    case "invite_circle_member":
    case "respond_circle_invite":
    case "create_circle_proposal":
    case "send_circle_message":
    case "edit_circle_message":
    case "delete_circle_message":
    case "vote_circle_proposal":
    case "publish_circle_proposal":
    case "leave_circle":
    case "manage_circle_member":
    case "add_circle_module_entry":
    case "update_circle_module_entry":
    case "delete_circle_module_entry":
      return "perform_buildmates_circle_action";
    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`unmapped_chat_action:${String(value)}`);
}
