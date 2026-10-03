import { z } from "zod";
import { idSchema, isoDateSchema } from "./schemas";

/**
 * The conversational surface uses bounded reads and scoped action groups.
 * The MCP server supplies the authenticated actor and
 * wraps mutations in its existing idempotency boundary; these schemas never
 * accept an actor id, URL, route, SQL fragment, or arbitrary command.
 */

export const chatWorkspaceViewSchema = z.enum([
  "account",
  "home",
  "introductions",
  "privacy",
  "profile",
  "projects",
  "project",
  "project_details",
  "connections",
  "connection",
  "room",
  "room_enhancements",
  "circles",
  "circle",
  "circle_messages",
  "activity",
  "blocked",
  "sources",
  "signals",
  "moderation",
  "project_collaborators",
]);

export const chatWorkspaceInputSchema = z.object({
  view: chatWorkspaceViewSchema,
  subjectId: idSchema.optional(),
  cursor: z.string().trim().min(1).max(300).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  now: isoDateSchema,
}).strict();

const confirmationSchema = z.literal("confirmed");
const bodySchema = z.string().trim().min(1).max(4_000);
const messageClientIdSchema = z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/);

const chatProfileFieldSchema = z.object({
  key: z.enum([
    "current_work", "previous_work", "interests", "ambitions", "stage",
    "exploring", "offers", "needs", "networking_intent", "cohorts",
  ]),
  value: z.union([
    z.string().trim().min(1).max(4_000),
    z.array(z.string().trim().min(1).max(240)).min(1).max(30),
  ]),
  audience: z.enum(["public", "signed_in", "suggested_connections", "mutual_connections", "private"]),
  allowMatching: z.boolean().optional(),
  sourceStatus: z.enum(["generated", "confirmed"]).optional(),
  provenance: z.enum(["self_reported", "codex_summary", "connected_app", "system"]).optional(),
}).strict();

const chatProfileSchema = z.object({
  handle: z.string().trim().min(3).max(32).regex(/^[a-z0-9_]+$/),
  displayName: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(1_200),
  allowMatching: z.boolean(),
  acceptanceMode: z.enum(["manual", "full_autopilot"]),
  coarseLocation: z.string().trim().max(120).optional(),
  locationMapOptIn: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  projectOrInterest: z.string().trim().max(240).optional(),
  portfolioLinks: z.array(z.string().url().max(2_048)).max(12).optional(),
  fields: z.array(chatProfileFieldSchema).max(10),
  statistics: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
    label: z.string().trim().min(1).max(50),
    value: z.string().trim().min(1).max(80),
    provenance: z.enum(["self_reported", "connected_app", "system"]),
    audience: z.enum(["public", "signed_in", "suggested_connections", "mutual_connections", "private"]),
  }).strict()).max(12).optional(),
}).strict();

const chatProjectSchema = z.object({
  slug: z.string().trim().min(1).max(72).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1_200),
  audience: z.enum(["public", "signed_in", "suggested_connections", "mutual_connections", "private"]),
  allowMatching: z.boolean(),
  stage: z.string().trim().min(1).max(60),
  status: z.enum(["draft", "active", "archived"]),
  links: z.array(z.object({ label: z.string().trim().min(1).max(40), url: z.string().url().max(2_048) }).strict()).max(12).optional(),
  taxonomy: z.array(z.object({ kind: z.enum(["topic", "tool", "domain"]), id: idSchema }).strict()).max(30).optional(),
}).strict();

const targetKindSchema = z.enum(["user", "profile", "project", "room", "circle", "message"]);
const reportReasonSchema = z.enum(["spam", "harassment", "impersonation", "unsafe_content", "privacy", "other"]);
export const accountExportSectionSchema = z.enum([
  "profileFields", "profileStatistics", "sourcePolicies", "workSignals", "projects", "projectUpdates", "networkingPulses",
  "connections", "privateConnectionNotes", "authoredRoomMessages", "authoredCircleMessages", "reports", "audit",
  "identityLinks", "webSessions", "introductionBudgets", "quietHours", "matchingSnoozes", "matchingExclusions",
  "follows", "watches", "inviteLinks", "cohortMemberships", "generatedSurfaces", "authoredSurfaceRevisions",
  "surfaceAssets", "surfaceAssetUploadGrants", "profileProjectMedia", "candidateEvaluations", "matchResponses",
  "connectionReminders", "roomMemberships", "introductionFeedback", "roomUpgradeProposals", "meetingProposals",
  "availabilityWindows", "circleMemberships", "circleProposals", "circleVotes", "authoredCircleModuleEntries",
  "circleMetricEntries", "notifications", "automation", "blocks", "moderationAppeals", "exportJobs", "deletionJobs",
  "setupState", "calendarReceipts",
]);
export type AccountExportSection = z.infer<typeof accountExportSectionSchema>;

export const chatActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("save_profile"), profile: chatProfileSchema }).strict(),
  z.object({ kind: z.literal("publish_profile"), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("hide_profile"), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("save_project"), project: chatProjectSchema, existingSlug: z.string().trim().min(1).max(72).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), confirmation: confirmationSchema.optional() }).strict().superRefine((value, context) => {
    if (value.project.status === "active" && value.project.audience === "public" && value.confirmation !== "confirmed") {
      context.addIssue({ code: "custom", path: ["confirmation"], message: "confirmation_required_for_public_project" });
    }
  }),
  z.object({ kind: z.literal("archive_project"), slug: idSchema }).strict(),
  z.object({ kind: z.literal("restore_project"), slug: idSchema }).strict(),
  z.object({ kind: z.literal("delete_project"), slug: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("invite_project_collaborator"), slug: idSchema, handle: z.string().trim().min(3).max(32).regex(/^@?[a-z0-9_]+$/), role: z.enum(["viewer", "editor"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("respond_project_collaboration"), slug: idSchema, accept: z.boolean(), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("remove_project_collaborator"), slug: idSchema, targetUserId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("transfer_project_ownership"), slug: idSchema, targetUserId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("accept_invite"), token: z.string().trim().min(16).max(200), confirmation: confirmationSchema }).strict(),

  z.object({ kind: z.literal("send_room_message"), roomId: idSchema, clientMessageId: messageClientIdSchema, body: bodySchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("edit_room_message"), roomId: idSchema, messageId: idSchema, body: bodySchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("delete_room_message"), roomId: idSchema, messageId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("mark_room_read"), roomId: idSchema, messageId: idSchema.nullable() }).strict(),
  z.object({ kind: z.literal("set_connection_preference"), connectionId: idSchema, preference: z.enum(["muted", "renewed_relevance", "updates"]), enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal("save_connection_note"), connectionId: idSchema, body: z.string().trim().max(4_000) }).strict(),
  z.object({ kind: z.literal("end_connection"), connectionId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("schedule_connection_reminder"), connectionId: idSchema, remindAt: isoDateSchema }).strict(),
  z.object({ kind: z.literal("dismiss_connection_reminder"), connectionId: idSchema, reminderId: idSchema }).strict(),
  z.object({ kind: z.literal("request_reconnect"), connectionId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("respond_reconnect"), connectionId: idSchema, requestId: idSchema, response: z.enum(["accepted", "declined"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("acknowledge_renewed_relevance"), connectionId: idSchema }).strict(),
  z.object({ kind: z.literal("save_introduction_feedback"), connectionId: idSchema, useful: z.boolean(), reasons: z.array(z.enum(["shared_context", "good_conversation", "future_relevance", "collaboration_started", "timing_off", "not_relevant"])).min(1).max(6), similarMatchPreference: z.enum(["more", "same", "less"]).nullable(), followUpIntent: z.enum(["keep_connected", "collaborate", "not_now"]).nullable(), privateNote: z.string().trim().max(2_000).nullable() }).strict(),

  z.object({ kind: z.literal("create_circle"), name: z.string().trim().min(1).max(120), purpose: z.string().trim().min(1).max(1_200), governanceMode: z.enum(["admin", "vote"]), inviteeUserIds: z.array(idSchema).max(20).default([]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("invite_circle_member"), circleId: idSchema, targetUserId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("respond_circle_invite"), circleId: idSchema, accept: z.boolean(), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("create_circle_proposal"), circleId: idSchema, proposalKind: z.enum(["design", "module", "rules", "request"]), payload: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 30_000, "proposal_payload_too_large"), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("send_circle_message"), circleId: idSchema, clientMessageId: messageClientIdSchema, body: bodySchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("edit_circle_message"), circleId: idSchema, messageId: idSchema, body: bodySchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("delete_circle_message"), circleId: idSchema, messageId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("vote_circle_proposal"), circleId: idSchema, proposalId: idSchema, vote: z.enum(["approve", "reject", "abstain"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("publish_circle_proposal"), circleId: idSchema, proposalId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("leave_circle"), circleId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("manage_circle_member"), circleId: idSchema, targetUserId: idSchema, memberAction: z.enum(["promote", "demote", "remove", "transfer"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("add_circle_module_entry"), circleId: idSchema, moduleId: idSchema, payload: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 8_000, "entry_payload_too_large") }).strict(),
  z.object({ kind: z.literal("update_circle_module_entry"), circleId: idSchema, moduleId: idSchema, entryId: idSchema, payload: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 8_000, "entry_payload_too_large") }).strict(),
  z.object({ kind: z.literal("delete_circle_module_entry"), circleId: idSchema, moduleId: idSchema, entryId: idSchema, confirmation: confirmationSchema }).strict(),

  z.object({ kind: z.literal("mark_activity_read"), notificationId: idSchema.optional(), all: z.boolean().optional() }).strict().superRefine((value, context) => {
    if (!value.notificationId && value.all !== true) context.addIssue({ code: "custom", path: ["notificationId"], message: "notification_id_or_all_required" });
    if (value.notificationId && value.all === true) context.addIssue({ code: "custom", path: ["all"], message: "choose_notification_or_all" });
  }),
  z.object({ kind: z.literal("block_user"), targetUserId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("unblock_user"), targetUserId: idSchema }).strict(),
  z.object({ kind: z.literal("report_target"), targetKind: targetKindSchema, targetId: idSchema, reasonCode: reportReasonSchema, details: z.string().trim().max(2_000).optional(), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("revoke_connected_app"), appId: idSchema }).strict(),
  z.object({ kind: z.literal("update_work_signal"), signalId: idSchema, summary: z.string().trim().min(1).max(12_000), audience: z.enum(["suggested_connections", "mutual_connections", "private"]), allowMatching: z.boolean(), expiresAt: isoDateSchema }).strict(),
  z.object({ kind: z.literal("delete_work_signal"), signalId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("pause_matching"), until: isoDateSchema }).strict(),
  z.object({ kind: z.literal("resume_matching") }).strict(),
  z.object({ kind: z.literal("propose_room_upgrade"), roomId: idSchema, proposalId: idSchema.optional(), modules: z.array(z.enum(["resource_shelf", "experiment_tracker", "decision_log", "feedback_queue", "milestone_tracker"])).min(1).max(5), explanation: z.string().trim().min(1).max(2_000), title: z.string().trim().min(1).max(120).optional(), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("respond_room_upgrade"), roomId: idSchema, proposalId: idSchema, response: z.enum(["accepted", "declined"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("add_room_module_entry"), roomId: idSchema, moduleId: idSchema, payload: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 8_000, "entry_payload_too_large") }).strict(),
  z.object({ kind: z.literal("update_room_module_entry"), roomId: idSchema, moduleId: idSchema, entryId: idSchema, payload: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 8_000, "entry_payload_too_large") }).strict(),
  z.object({ kind: z.literal("delete_room_module_entry"), roomId: idSchema, moduleId: idSchema, entryId: idSchema, confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("save_availability"), roomId: idSchema, clientWindowId: messageClientIdSchema, startsAt: isoDateSchema, endsAt: isoDateSchema, timezone: z.string().trim().min(1).max(80) }).strict(),
  z.object({ kind: z.literal("withdraw_availability"), roomId: idSchema, windowId: idSchema }).strict(),
  z.object({ kind: z.literal("propose_meeting"), roomId: idSchema, clientRequestId: messageClientIdSchema, startsAt: isoDateSchema, endsAt: isoDateSchema, timezone: z.string().trim().min(1).max(80), note: z.string().trim().max(1_000).nullable().optional().default(null), parentProposalId: idSchema.nullable().optional(), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("respond_meeting"), roomId: idSchema, proposalId: idSchema, response: z.enum(["accepted", "declined"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("disable_autopilot"), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("disconnect_all"), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("redact_shared_context"), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("publish_project_update"), slug: idSchema, body: z.string().trim().min(1).max(2_000), audience: z.enum(["public", "signed_in", "suggested_connections", "mutual_connections", "private"]), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("appeal_moderation_case"), caseId: idSchema, statement: z.string().trim().min(20).max(3_000), confirmation: confirmationSchema }).strict(),
  z.object({ kind: z.literal("request_export"), confirmation: confirmationSchema, section: accountExportSectionSchema.optional(), cursor: z.string().trim().max(300).optional(), limit: z.number().int().min(1).max(100).default(50) }).strict(),
  z.object({ kind: z.literal("prepare_account_deletion") }).strict(),
  z.object({ kind: z.literal("request_deletion"), receipt: idSchema, confirmation: z.literal("DELETE BUILDMATES") }).strict(),
]);

export type ChatWorkspaceView = z.infer<typeof chatWorkspaceViewSchema>;
export type ChatWorkspaceInput = z.infer<typeof chatWorkspaceInputSchema>;
export type ChatAction = z.infer<typeof chatActionSchema>;

export type ChatWorkspaceResult = {
  view: ChatWorkspaceView;
  subjectId?: string;
  data: unknown;
  nextCursor: string | null;
  generatedAt: string;
};

export type ChatActionResult = {
  action: ChatAction["kind"];
  confirmationState: "persisted" | "queued" | "completed";
  details: unknown;
};
