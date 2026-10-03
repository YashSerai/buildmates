import type { AccountExportSection, ChatAction, ChatActionResult, ChatWorkspaceInput, ChatWorkspaceResult } from "@buildmates/mcp-core";
import { chatActionSchema, chatWorkspaceInputSchema } from "@buildmates/mcp-core";
import { getOnboardingSnapshot, revokeSource, runPrivacyCommand, updateWorkSignal } from "./onboarding-data";
import { changeProjectLifecycle, getProjectBySlug, hideProfile, publishProfile, publishProjectUpdate, saveProfile, saveProject, type ProfileInput, type ProjectInput } from "../profile-projects/service";
import { inviteProjectCollaborator, listProjectCollaboratorsPage, removeProjectCollaborator, respondProjectCollaboration, transferProjectOwnership } from "../profile-projects/collaborators";
import { getRoomSummary, listConnectionsPage, listMessagesPage, sendMessage, editMessage, deleteMessage } from "../rooms/service";
import { acknowledgeRenewedRelevance, addRoomModuleEntry, createReminder, deleteRoomModuleEntry, dismissReminder, endConnection, getConnectionDetail, listRoomEnhancements, markRoomRead, proposeMeeting, proposeRoomUpgrade, requestReconnect, respondMeeting, respondReconnect, respondRoomUpgrade, saveAvailabilityWindow, saveIntroductionFeedback, savePrivateNote, updateConnectionPreference, updateRoomModuleEntry, withdrawAvailabilityWindow } from "../rooms/lifecycle";
import { createCircle, createCircleProposal, addCircleModuleEntry, deleteCircleModuleEntry, editCircleMessage, deleteCircleMessage, getCircle, inviteCircleMember, listCircleMessagesPage, listCirclesPage, manageCircleMember, respondCircleInvite, sendCircleMessage, updateCircleModuleEntry, voteCircleProposal, publishCircleProposal, leaveCircle } from "../circles/service";
import { listBlockedBuildersPage, blockBuilder, reportTarget, unblockBuilder } from "../safety/service";
import { listActivity, markActivityRead } from "../activity/service";
import { beginAccountDeletion } from "../privacy/account-deletion";
import { consumeAccountExportRateLimit, getAccountExport } from "../privacy/account-export";
import { appealModerationCase, listAppealableOutcomes, listReporterStatus } from "../moderation/service";
import { acceptInvite, getHome, listInvitesPage } from "../discovery/service";
import { listMatchInboxPage } from "../matching/service";
import type { R2Like } from "./r2";

type DB = D1Database;

export type ReadChatWorkspaceInput = ChatWorkspaceInput & { userId: string };
export type PerformChatActionInput = { userId: string; action: ChatAction; now: string; idempotencyKey?: string };

export async function readChatWorkspace(DB: DB, raw: ReadChatWorkspaceInput): Promise<ChatWorkspaceResult> {
  const { userId, ...request } = raw;
  const input = chatWorkspaceInputSchema.parse(request);
  const now = parseNow(input.now);
  const subjectId = input.subjectId;
  let data: unknown;
  let nextCursor: string | null = null;

  switch (input.view) {
    case "account": {
      data = await getOnboardingSnapshot(DB, userId, null);
      break;
    }
    case "home": {
      data = await getHome(DB, userId);
      break;
    }
    case "introductions": {
      const cursor = parseIntroductionsCursor(input.cursor);
      const matches = cursor.matchesDone ? { items: [], nextCursor: null } : await listMatchInboxPage(DB, userId, now, cursor.matchesCursor, input.limit);
      const invites = cursor.invitesDone ? { items: [], nextCursor: null } : await listInvitesPage(DB, userId, cursor.invitesCursor, input.limit);
      data = { matches: matches.items, invites: invites.items };
      nextCursor = matches.nextCursor || invites.nextCursor
        ? introductionsCursor(matches.nextCursor, invites.nextCursor, !matches.nextCursor, !invites.nextCursor)
        : null;
      break;
    }
    case "privacy": {
      const snapshot = await getOnboardingSnapshot(DB, userId, null);
      data = { lifecycle: snapshot.lifecycle, sources: snapshot.sources, signals: snapshot.signals, audit: snapshot.audit, holdings: snapshot.holdings };
      break;
    }
    case "profile": {
      const snapshot = await getOnboardingSnapshot(DB, userId, null);
      data = snapshot.profile;
      break;
    }
    case "projects": {
      const cursor = parseDescendingCursor(input.cursor, "p");
      const rows = cursor
        ? await DB.prepare(`SELECT id,slug,title,summary,audience,allow_matching AS allowMatching,status,stage,indexable,published_at AS publishedAt,created_at AS createdAt,updated_at AS updatedAt
          FROM projects WHERE owner_user_id=? AND status<>'deleted' AND (updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(userId, cursor.at, cursor.at, cursor.id, input.limit + 1).all<ProjectPageRow>()
        : await DB.prepare(`SELECT id,slug,title,summary,audience,allow_matching AS allowMatching,status,stage,indexable,published_at AS publishedAt,created_at AS createdAt,updated_at AS updatedAt
          FROM projects WHERE owner_user_id=? AND status<>'deleted' ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(userId, input.limit + 1).all<ProjectPageRow>();
      const page = rows.results.slice(0, input.limit);
      data = page;
      nextCursor = rows.results.length > input.limit && page.length ? descendingCursor("p", page[page.length - 1]!.updatedAt, page[page.length - 1]!.id) : null;
      break;
    }
    case "project":
    case "project_details": {
      const project = await getProjectBySlug(DB, requireSubject(subjectId, "project"), userId);
      if (!project) throw new Error("project_not_found");
      data = project;
      break;
    }
    case "connections": {
      const page = await listConnectionsPage(DB, userId, input.cursor ?? null, input.limit);
      data = page.items;
      nextCursor = page.nextCursor;
      break;
    }
    case "connection": {
      data = await getConnectionDetail(DB, requireSubject(subjectId, "connection"), userId);
      break;
    }
    case "room": {
      const roomId = requireSubject(subjectId, "room");
      const page = await listMessagesPage(DB, roomId, userId, input.cursor ?? null, input.limit);
      data = { room: await getRoomSummary(DB, roomId, userId), messages: page.items };
      nextCursor = page.nextCursor;
      break;
    }
    case "room_enhancements": {
      data = await listRoomEnhancements(DB, requireSubject(subjectId, "room"), userId);
      break;
    }
    case "circles": {
      const page = await listCirclesPage(DB, userId, input.cursor ?? null, input.limit);
      data = page.items;
      nextCursor = page.nextCursor;
      break;
    }
    case "circle": {
      data = await getCircle(DB, requireSubject(subjectId, "circle"), userId);
      if (!data) throw new Error("circle_not_found");
      break;
    }
    case "circle_messages": {
      const circleId = requireSubject(subjectId, "circle");
      const page = await listCircleMessagesPage(DB, circleId, userId, input.cursor ?? null, input.limit);
      data = { circleId, messages: page.items };
      nextCursor = page.nextCursor;
      break;
    }
    case "activity": {
      const activity = await listActivity(DB, { userId, cursor: input.cursor, limit: input.limit, now });
      data = activity.items;
      nextCursor = activity.nextCursor;
      break;
    }
    case "blocked": {
      const page = await listBlockedBuildersPage(DB, userId, input.cursor ?? null, input.limit);
      data = page.items;
      nextCursor = page.nextCursor;
      break;
    }
    case "sources": {
      const cursor = parseAscendingCursor(input.cursor, "s");
      const rows = cursor
        ? await DB.prepare(`SELECT app_id AS appId,display_name AS displayName,category,access_mode AS accessMode,last_reviewed_at AS lastReviewedAt,revoked_at AS revokedAt
          FROM connected_app_preferences WHERE user_id=? AND app_id>? ORDER BY app_id ASC LIMIT ?`).bind(userId, cursor.id, input.limit + 1).all<SourcePageRow>()
        : await DB.prepare(`SELECT app_id AS appId,display_name AS displayName,category,access_mode AS accessMode,last_reviewed_at AS lastReviewedAt,revoked_at AS revokedAt
          FROM connected_app_preferences WHERE user_id=? ORDER BY app_id ASC LIMIT ?`).bind(userId, input.limit + 1).all<SourcePageRow>();
      const page = rows.results.slice(0, input.limit);
      data = page;
      nextCursor = rows.results.length > input.limit && page.length ? ascendingCursor("s", page[page.length - 1]!.appId) : null;
      break;
    }
    case "signals": {
      const cursor = parseDescendingCursor(input.cursor, "w");
      const rows = cursor
        ? await DB.prepare(`SELECT id,source_app_id AS sourceAppId,free_text_summary AS summary,audience,allow_matching AS allowMatching,approved_at AS approvedAt,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt,updated_at AS updatedAt
          FROM work_signals WHERE user_id=? AND (updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(userId, cursor.at, cursor.at, cursor.id, input.limit + 1).all<SignalPageRow>()
        : await DB.prepare(`SELECT id,source_app_id AS sourceAppId,free_text_summary AS summary,audience,allow_matching AS allowMatching,approved_at AS approvedAt,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt,updated_at AS updatedAt
          FROM work_signals WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(userId, input.limit + 1).all<SignalPageRow>();
      const page = rows.results.slice(0, input.limit);
      data = page;
      nextCursor = rows.results.length > input.limit && page.length ? descendingCursor("w", page[page.length - 1]!.updatedAt, page[page.length - 1]!.id) : null;
      break;
    }
    case "moderation": {
      data = { reports: await listReporterStatus(DB, userId), appealableOutcomes: await listAppealableOutcomes(DB, userId) };
      break;
    }
    case "project_collaborators": {
      const page = await listProjectCollaboratorsPage(DB, userId, requireSubject(subjectId, "project"), input.cursor ?? null, input.limit);
      data = page.value;
      nextCursor = page.nextCursor;
      break;
    }
  }

  return { view: input.view, ...(subjectId ? { subjectId } : {}), data, nextCursor, generatedAt: new Date(now).toISOString() };
}

export async function performChatAction(DB: DB, raw: PerformChatActionInput, assets?: R2Like): Promise<ChatActionResult> {
  const action = chatActionSchema.parse(raw.action);
  const now = parseNow(raw.now);
  const userId = requireUserId(raw.userId);

  switch (action.kind) {
    case "save_profile": {
      const profile = await saveProfile(DB, userId, toProfileInput(action.profile));
      return persisted(action.kind, profile);
    }
    case "publish_profile": {
      await publishProfile(DB, userId);
      return persisted(action.kind, { published: true });
    }
    case "hide_profile": {
      await hideProfile(DB, userId);
      return persisted(action.kind, { hidden: true });
    }
    case "save_project": {
      const project = await saveProject(DB, userId, toProjectInput(action.project), action.existingSlug);
      return persisted(action.kind, project);
    }
    case "archive_project":
      await changeProjectLifecycle(DB, userId, action.slug, "archive");
      return persisted(action.kind, { slug: action.slug, status: "archived" });
    case "restore_project":
      await changeProjectLifecycle(DB, userId, action.slug, "restore");
      return persisted(action.kind, { slug: action.slug, status: "active" });
    case "delete_project":
      await changeProjectLifecycle(DB, userId, action.slug, "delete");
      return persisted(action.kind, { slug: action.slug, status: "deleted" });
    case "invite_project_collaborator": {
      const result = await inviteProjectCollaborator(DB, { actorId: userId, slug: action.slug, handle: action.handle, role: action.role, now });
      return persisted(action.kind, result);
    }
    case "respond_project_collaboration": {
      const result = await respondProjectCollaboration(DB, { actorId: userId, slug: action.slug, accept: action.accept, now });
      return persisted(action.kind, result);
    }
    case "remove_project_collaborator": {
      const result = await removeProjectCollaborator(DB, { actorId: userId, slug: action.slug, targetUserId: action.targetUserId });
      return persisted(action.kind, result);
    }
    case "transfer_project_ownership": {
      const result = await transferProjectOwnership(DB, { actorId: userId, slug: action.slug, targetUserId: action.targetUserId, now });
      return persisted(action.kind, result);
    }
    case "accept_invite": {
      const result = await acceptInvite(DB, action.token, userId);
      return persisted(action.kind, result);
    }

    case "send_room_message": {
      const result = await sendMessage(DB, { roomId: action.roomId, userId, clientMessageId: action.clientMessageId, body: action.body, now });
      return persisted(action.kind, result);
    }
    case "edit_room_message": {
      await editMessage(DB, { roomId: action.roomId, messageId: action.messageId, userId, body: action.body, now });
      return persisted(action.kind, { roomId: action.roomId, messageId: action.messageId, edited: true });
    }
    case "delete_room_message": {
      await deleteMessage(DB, { roomId: action.roomId, messageId: action.messageId, userId, now });
      return persisted(action.kind, { roomId: action.roomId, messageId: action.messageId, deleted: true });
    }
    case "mark_room_read": {
      await markRoomRead(DB, { roomId: action.roomId, userId, messageId: action.messageId, now });
      return persisted(action.kind, { roomId: action.roomId, messageId: action.messageId, markedRead: true });
    }
    case "set_connection_preference": {
      await updateConnectionPreference(DB, { connectionId: action.connectionId, userId, kind: action.preference, enabled: action.enabled, now });
      return persisted(action.kind, { connectionId: action.connectionId, preference: action.preference, enabled: action.enabled });
    }
    case "save_connection_note": {
      await savePrivateNote(DB, { connectionId: action.connectionId, userId, body: action.body, now });
      return persisted(action.kind, { connectionId: action.connectionId, saved: Boolean(action.body.trim()) });
    }
    case "end_connection": {
      await endConnection(DB, { connectionId: action.connectionId, userId, now });
      return persisted(action.kind, { connectionId: action.connectionId, state: "ended" });
    }
    case "schedule_connection_reminder": {
      const result = await createReminder(DB, { connectionId: action.connectionId, userId, remindAt: parseNow(action.remindAt), now });
      return persisted(action.kind, { connectionId: action.connectionId, ...result });
    }
    case "dismiss_connection_reminder": {
      await dismissReminder(DB, { connectionId: action.connectionId, userId, reminderId: action.reminderId });
      return persisted(action.kind, { connectionId: action.connectionId, reminderId: action.reminderId, dismissed: true });
    }
    case "request_reconnect": {
      const result = await requestReconnect(DB, { connectionId: action.connectionId, userId, now });
      return persisted(action.kind, result);
    }
    case "respond_reconnect": {
      await respondReconnect(DB, { connectionId: action.connectionId, userId, requestId: action.requestId, response: action.response, now });
      return persisted(action.kind, { connectionId: action.connectionId, requestId: action.requestId, response: action.response });
    }
    case "acknowledge_renewed_relevance": {
      await acknowledgeRenewedRelevance(DB, { connectionId: action.connectionId, userId, now });
      return persisted(action.kind, { connectionId: action.connectionId, acknowledged: true });
    }
    case "save_introduction_feedback": {
      await saveIntroductionFeedback(DB, { connectionId: action.connectionId, userId, useful: action.useful, reasons: action.reasons, similarMatchPreference: action.similarMatchPreference, followUpIntent: action.followUpIntent, privateNote: action.privateNote, now });
      return persisted(action.kind, { connectionId: action.connectionId, saved: true });
    }

    case "create_circle": {
      const circle = await createCircle(DB, { actorId: userId, name: action.name, purpose: action.purpose, governanceMode: action.governanceMode, inviteeUserIds: action.inviteeUserIds, now });
      return persisted(action.kind, circle);
    }
    case "invite_circle_member": {
      await inviteCircleMember(DB, { actorId: userId, circleId: action.circleId, userId: action.targetUserId, now });
      return persisted(action.kind, { circleId: action.circleId, targetUserId: action.targetUserId, invited: true });
    }
    case "respond_circle_invite": {
      await respondCircleInvite(DB, { actorId: userId, circleId: action.circleId, accept: action.accept, now });
      return persisted(action.kind, { circleId: action.circleId, accepted: action.accept });
    }
    case "create_circle_proposal": {
      const result = await createCircleProposal(DB, { actorId: userId, circleId: action.circleId, kind: action.proposalKind, payload: action.payload, now });
      return persisted(action.kind, result);
    }
    case "send_circle_message": {
      const result = await sendCircleMessage(DB, { actorId: userId, circleId: action.circleId, clientMessageId: action.clientMessageId, body: action.body, now });
      return persisted(action.kind, result);
    }
    case "edit_circle_message": {
      await editCircleMessage(DB, { actorId: userId, circleId: action.circleId, messageId: action.messageId, body: action.body, now });
      return persisted(action.kind, { circleId: action.circleId, messageId: action.messageId, edited: true });
    }
    case "delete_circle_message": {
      await deleteCircleMessage(DB, { actorId: userId, circleId: action.circleId, messageId: action.messageId, now });
      return persisted(action.kind, { circleId: action.circleId, messageId: action.messageId, deleted: true });
    }
    case "vote_circle_proposal": {
      await voteCircleProposal(DB, { actorId: userId, circleId: action.circleId, proposalId: action.proposalId, vote: action.vote, now });
      return persisted(action.kind, { circleId: action.circleId, proposalId: action.proposalId, vote: action.vote });
    }
    case "publish_circle_proposal": {
      await publishCircleProposal(DB, { actorId: userId, circleId: action.circleId, proposalId: action.proposalId, now });
      return persisted(action.kind, { circleId: action.circleId, proposalId: action.proposalId, published: true });
    }
    case "leave_circle": {
      await leaveCircle(DB, { actorId: userId, circleId: action.circleId });
      return persisted(action.kind, { circleId: action.circleId, left: true });
    }
    case "manage_circle_member": {
      await manageCircleMember(DB, { actorId: userId, circleId: action.circleId, targetUserId: action.targetUserId, action: action.memberAction });
      return persisted(action.kind, { circleId: action.circleId, targetUserId: action.targetUserId, action: action.memberAction });
    }
    case "add_circle_module_entry": {
      const result = await addCircleModuleEntry(DB, { actorId: userId, circleId: action.circleId, moduleId: action.moduleId, payload: action.payload, now });
      return persisted(action.kind, result);
    }
    case "update_circle_module_entry": {
      await updateCircleModuleEntry(DB, { actorId: userId, circleId: action.circleId, moduleId: action.moduleId, entryId: action.entryId, payload: action.payload, now });
      return persisted(action.kind, { circleId: action.circleId, moduleId: action.moduleId, entryId: action.entryId, updated: true });
    }
    case "delete_circle_module_entry": {
      await deleteCircleModuleEntry(DB, { actorId: userId, circleId: action.circleId, moduleId: action.moduleId, entryId: action.entryId, now });
      return persisted(action.kind, { circleId: action.circleId, moduleId: action.moduleId, entryId: action.entryId, deleted: true });
    }

    case "propose_room_upgrade": {
      const result = await proposeRoomUpgrade(DB, { roomId: action.roomId, userId, proposalId: action.proposalId, modules: action.modules, explanation: action.explanation, title: action.title, now });
      return persisted(action.kind, result);
    }
    case "respond_room_upgrade": {
      const result = await respondRoomUpgrade(DB, { roomId: action.roomId, proposalId: action.proposalId, userId, response: action.response, now });
      return persisted(action.kind, result);
    }
    case "add_room_module_entry": {
      const result = await addRoomModuleEntry(DB, { roomId: action.roomId, userId, moduleId: action.moduleId, payload: action.payload, now });
      return persisted(action.kind, result);
    }
    case "update_room_module_entry": {
      await updateRoomModuleEntry(DB, { roomId: action.roomId, userId, moduleId: action.moduleId, entryId: action.entryId, payload: action.payload, now });
      return persisted(action.kind, { roomId: action.roomId, moduleId: action.moduleId, entryId: action.entryId, updated: true });
    }
    case "delete_room_module_entry": {
      await deleteRoomModuleEntry(DB, { roomId: action.roomId, userId, moduleId: action.moduleId, entryId: action.entryId, now });
      return persisted(action.kind, { roomId: action.roomId, moduleId: action.moduleId, entryId: action.entryId, deleted: true });
    }
    case "save_availability": {
      const result = await saveAvailabilityWindow(DB, { roomId: action.roomId, userId, clientWindowId: action.clientWindowId, startsAt: parseNow(action.startsAt), endsAt: parseNow(action.endsAt), timezone: action.timezone, now });
      return persisted(action.kind, { roomId: action.roomId, ...result });
    }
    case "withdraw_availability": {
      await withdrawAvailabilityWindow(DB, { roomId: action.roomId, userId, windowId: action.windowId, now });
      return persisted(action.kind, { roomId: action.roomId, windowId: action.windowId, withdrawn: true });
    }
    case "propose_meeting": {
      const result = await proposeMeeting(DB, { roomId: action.roomId, userId, clientRequestId: action.clientRequestId, startsAt: parseNow(action.startsAt), endsAt: parseNow(action.endsAt), timezone: action.timezone, note: action.note, parentProposalId: action.parentProposalId, now });
      return persisted(action.kind, { roomId: action.roomId, ...result });
    }
    case "respond_meeting": {
      await respondMeeting(DB, { roomId: action.roomId, userId, proposalId: action.proposalId, response: action.response, now });
      return persisted(action.kind, { roomId: action.roomId, proposalId: action.proposalId, response: action.response });
    }

    case "mark_activity_read": {
      const result = await markActivityRead(DB, { userId, notificationId: action.notificationId, all: action.all, now });
      return persisted(action.kind, result);
    }
    case "block_user": {
      await blockBuilder(DB, { actorId: userId, targetUserId: action.targetUserId, now });
      return persisted(action.kind, { targetUserId: action.targetUserId, blocked: true });
    }
    case "unblock_user": {
      await unblockBuilder(DB, { actorId: userId, targetUserId: action.targetUserId, now });
      return persisted(action.kind, { targetUserId: action.targetUserId, blocked: false });
    }
    case "report_target": {
      const result = await reportTarget(DB, { actorId: userId, targetKind: action.targetKind, targetId: action.targetId, reasonCode: action.reasonCode, details: action.details, now });
      return persisted(action.kind, result);
    }
    case "revoke_connected_app": {
      await revokeSource(DB, userId, action.appId, now);
      return persisted(action.kind, { appId: action.appId, revoked: true });
    }
    case "update_work_signal": {
      await updateWorkSignal(DB, userId, { action: "update", id: action.signalId, summary: action.summary, audience: action.audience, allowMatching: action.allowMatching, expiresAt: action.expiresAt }, now);
      return persisted(action.kind, { signalId: action.signalId, updated: true });
    }
    case "delete_work_signal": {
      await updateWorkSignal(DB, userId, { action: "delete", id: action.signalId }, now);
      return persisted(action.kind, { signalId: action.signalId, deleted: true });
    }
    case "pause_matching": {
      const result = await runPrivacyCommand(DB, userId, { command: "pause_matching", until: action.until }, undefined, now);
      return persisted(action.kind, result);
    }
    case "resume_matching": {
      const result = await runPrivacyCommand(DB, userId, { command: "resume_matching" }, undefined, now);
      return persisted(action.kind, result);
    }
    case "disable_autopilot": {
      const result = await runPrivacyCommand(DB, userId, { command: "disable_autopilot" }, undefined, now);
      return persisted(action.kind, result);
    }
    case "disconnect_all": {
      const result = await runPrivacyCommand(DB, userId, { command: "disconnect_all" }, undefined, now);
      return persisted(action.kind, result);
    }
    case "redact_shared_context": {
      const result = await runPrivacyCommand(DB, userId, { command: "redact_shared_context" }, undefined, now);
      return persisted(action.kind, result);
    }
    case "publish_project_update": {
      const result = await publishProjectUpdate(DB, userId, action.slug, { body: action.body, audience: action.audience, now });
      return persisted(action.kind, result);
    }
    case "appeal_moderation_case": {
      await appealModerationCase(DB, { userId, caseId: action.caseId, statement: action.statement, now });
      return persisted(action.kind, { caseId: action.caseId, received: true });
    }
    case "request_export": {
      await consumeAccountExportRateLimit(DB, userId, { section: action.section, cursor: action.cursor }, now);
      const result = await getAccountExport(DB, userId, { section: action.section as AccountExportSection | undefined, cursor: action.cursor, limit: action.limit, now, maxBytes: 256_000 });
      return { action: action.kind, confirmationState: "completed", details: result };
    }
    case "prepare_account_deletion": {
      const receipt = `deletion_confirmation_${crypto.randomUUID()}`;
      const expiresAt = now + 10 * 60_000;
      await DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(`audit_${crypto.randomUUID()}`, userId, "account.deletion_confirmation_prepared", "deletion_confirmation", receipt, JSON.stringify({ expiresAt }), now).run();
      return { action: action.kind, confirmationState: "persisted", details: {
        receipt, expiresAt: new Date(expiresAt).toISOString(),
        deletionRequested: false,
        consequences: [
          "Confirming deletion immediately revokes account access, removes private account data and redacts shared content.",
          "Owned image cleanup may continue after access is revoked if storage cleanup needs another attempt.",
          "Deletion cannot be undone. This preparation leaves the account active and expires unused if you cancel.",
        ],
      } };
    }
    case "request_deletion": {
      const confirmation = await DB.prepare("SELECT metadata_json AS metadataJson FROM audit_events WHERE actor_user_id=? AND action='account.deletion_confirmation_prepared' AND object_kind='deletion_confirmation' AND object_id=? ORDER BY created_at DESC LIMIT 1").bind(userId, action.receipt).first<{ metadataJson: string }>();
      const expiresAt = confirmation ? safeObject(confirmation.metadataJson).expiresAt : null;
      if (typeof expiresAt !== "number" || expiresAt <= now) throw new Error("deletion_confirmation_expired");
      const result = await beginAccountDeletion(DB, userId, assets, raw.idempotencyKey ? { operation: "perform_buildmates_action", key: raw.idempotencyKey } : undefined);
      return { action: action.kind, confirmationState: result.status === "complete" ? "completed" : "queued", details: result };
    }
  }
}

function persisted(action: ChatAction["kind"], details: unknown): ChatActionResult {
  return { action, confirmationState: "persisted", details };
}

function requireSubject(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name}_subject_required`);
  return value;
}

function requireUserId(value: string): string {
  const userId = value.trim();
  if (!userId || userId.length > 256) throw new Error("actor_required");
  return userId;
}

function parseNow(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid_timestamp");
  return parsed;
}

type ProjectPageRow = { id: string; updatedAt: number } & Record<string, unknown>;
type SignalPageRow = { id: string; updatedAt: number } & Record<string, unknown>;
type SourcePageRow = { appId: string } & Record<string, unknown>;

function parseDescendingCursor(value: string | undefined, prefix: "p" | "w"): { at: number; id: string } | null {
  if (!value) return null;
  const first = value.indexOf(":");
  const second = value.indexOf(":", first + 1);
  if (first !== 1 || second <= first + 1) throw new Error("invalid_workspace_cursor");
  if (value.slice(0, first) !== prefix) throw new Error("invalid_workspace_cursor");
  const at = Number(value.slice(first + 1, second));
  if (!Number.isSafeInteger(at) || at < 0) throw new Error("invalid_workspace_cursor");
  try {
    const id = decodeURIComponent(value.slice(second + 1));
    if (!id || id.length > 256) throw new Error("invalid_workspace_cursor");
    return { at, id };
  } catch {
    throw new Error("invalid_workspace_cursor");
  }
}

function descendingCursor(prefix: "p" | "w", at: number, id: string): string {
  return `${prefix}:${at}:${encodeURIComponent(id)}`;
}

function parseAscendingCursor(value: string | undefined, prefix: "s"): { id: string } | null {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (separator !== 1 || value.slice(0, separator) !== prefix) throw new Error("invalid_workspace_cursor");
  try {
    const id = decodeURIComponent(value.slice(separator + 1));
    if (!id || id.length > 256) throw new Error("invalid_workspace_cursor");
    return { id };
  } catch {
    throw new Error("invalid_workspace_cursor");
  }
}

function ascendingCursor(prefix: "s", id: string): string {
  return `${prefix}:${encodeURIComponent(id)}`;
}

type IntroductionCursor = { matchesCursor: string | null; invitesCursor: string | null; matchesDone: boolean; invitesDone: boolean };
function parseIntroductionsCursor(value: string | undefined): IntroductionCursor {
  if (!value) return { matchesCursor: null, invitesCursor: null, matchesDone: false, invitesDone: false };
  if (!value.startsWith("ix:")) throw new Error("invalid_introduction_cursor");
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice(3))) as Record<string, unknown>;
    const matchesCursor = parsed.matchesCursor == null ? null : String(parsed.matchesCursor);
    const invitesCursor = parsed.invitesCursor == null ? null : String(parsed.invitesCursor);
    const matchesDone = parsed.matchesDone === true;
    const invitesDone = parsed.invitesDone === true;
    if ((matchesCursor && !matchesCursor.startsWith("mi:")) || (invitesCursor && !invitesCursor.startsWith("i:"))) throw new Error("invalid_introduction_cursor");
    return { matchesCursor, invitesCursor, matchesDone, invitesDone };
  } catch {
    throw new Error("invalid_introduction_cursor");
  }
}
function introductionsCursor(matchesCursor: string | null, invitesCursor: string | null, matchesDone: boolean, invitesDone: boolean): string {
  return `ix:${encodeURIComponent(JSON.stringify({ matchesCursor, invitesCursor, matchesDone, invitesDone }))}`;
}

function toProfileInput(value: Extract<ChatAction, { kind: "save_profile" }>['profile']): ProfileInput {
  return {
    handle: value.handle,
    displayName: value.displayName,
    summary: value.summary,
    allowMatching: value.allowMatching,
    acceptanceMode: value.acceptanceMode,
    coarseLocation: value.coarseLocation,
    locationMapOptIn: value.locationMapOptIn,
    timezone: value.timezone,
    projectOrInterest: value.projectOrInterest,
    portfolioLinks: value.portfolioLinks,
    fields: value.fields,
    statistics: value.statistics,
  };
}

function toProjectInput(value: Extract<ChatAction, { kind: "save_project" }>['project']): ProjectInput {
  return {
    slug: value.slug,
    title: value.title,
    summary: value.summary,
    audience: value.audience,
    allowMatching: value.allowMatching,
    stage: value.stage,
    status: value.status,
    links: value.links,
    taxonomy: value.taxonomy,
  };
}

function safeObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
