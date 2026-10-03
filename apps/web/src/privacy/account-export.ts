import type { AccountExportSection } from "@buildmates/mcp-core";
import { consumeWebRateLimit, WebRateLimitError } from "../security/rate-limit";

type DB = D1Database;
type ExportOptions = { section?: AccountExportSection; cursor?: string; limit?: number; now?: number; maxBytes?: number };
type SectionPage = { items: unknown[]; nextCursor: string | null };
const MAX_EXPORT_OFFSET = 1_000_000;

/**
 * Keep export start and continuation traffic on separate actor-bound budgets.
 * A complete multi-section export can require many continuation requests, but
 * a fresh full export remains intentionally scarce and expensive.
 */
export async function consumeAccountExportRateLimit(
  DB: DB,
  userId: string,
  options: Pick<ExportOptions, "section" | "cursor"> = {},
  now = Date.now(),
): Promise<void> {
  const continuation = Boolean(options.section || options.cursor);
  try {
    await consumeWebRateLimit(
      DB,
      continuation ? "account_export_page" : "account_export",
      userId,
      continuation ? 500 : 3,
      continuation ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      now,
    );
  } catch (error) {
    if (error instanceof WebRateLimitError) {
      throw new Error(continuation ? "account_export_page_rate_limited" : "account_export_rate_limited");
    }
    throw error;
  }
}

/**
 * Return the authenticated user's export as bounded, in-band JSON. Every
 * collection is queried from the canonical tables and only authored messages
 * are included, so a chat or MCP caller never receives another member's raw
 * room or Circle messages.
 */
export async function getAccountExport(DB: DB, userId: string, options: ExportOptions = {}) {
  const account = await DB.prepare("SELECT id FROM users WHERE id=? LIMIT 1").bind(userId).first<{ id: string }>();
  if (!account) throw new Error("account_not_found");
  const limit = Math.max(1, Math.min(100, options.limit ?? 50));
  const selected = options.section;
  const offset = parseCursor(options.cursor);
  const profile = await DB.prepare("SELECT id,display_name AS displayName,summary,project_or_interest AS projectOrInterest,portfolio_links_json AS portfolioLinks,audience,cohort_scope_id AS cohortScopeId,allow_matching AS allowMatching,acceptance_mode AS acceptanceMode,indexable,coarse_location AS coarseLocation,location_map_opt_in AS locationMapOptIn,timezone,published_at AS publishedAt,created_at AS createdAt,updated_at AS updatedAt FROM profiles WHERE user_id=?").bind(userId).first();
  const profileId = (profile as { id?: string } | null)?.id ?? "";
  const handle = await DB.prepare("SELECT handle,created_at AS createdAt FROM handles WHERE user_id=?").bind(userId).first();
  const now = options.now ?? Date.now();

  const [profileFields, profileStatistics, sourcePolicies, workSignals, projects, projectUpdates, networkingPulses, connections, privateConnectionNotes, authoredRoomMessages, authoredCircleMessages, reports, audit, identityLinks, webSessions, introductionBudgets, quietHours, matchingSnoozes, matchingExclusions, follows, watches, inviteLinks, cohortMemberships, generatedSurfaces, authoredSurfaceRevisions, surfaceAssets, surfaceAssetUploadGrants, profileProjectMedia, candidateEvaluations, matchResponses, connectionReminders, roomMemberships, introductionFeedback, roomUpgradeProposals, meetingProposals, availabilityWindows, circleMemberships, circleProposals, circleVotes, authoredCircleModuleEntries, circleMetricEntries, notifications, automation, blocks, moderationAppeals, exportJobs, deletionJobs, setupState, calendarReceipts] = await Promise.all([
    section(DB, "profileFields", "SELECT field_key AS fieldKey,value_json AS value,audience,cohort_scope_id AS cohortScopeId,allow_matching AS allowMatching,source_status AS sourceStatus,provenance,updated_at AS updatedAt FROM profile_fields WHERE profile_id=? ORDER BY field_key", [profileId], selected, offset, limit),
    section(DB, "profileStatistics", "SELECT stat_key AS statKey,label,value,provenance,audience,updated_at AS updatedAt FROM profile_statistics WHERE profile_id=? ORDER BY stat_key", [profileId], selected, offset, limit),
    section(DB, "sourcePolicies", "SELECT id,app_id AS appId,display_name AS displayName,category,access_mode AS accessMode,last_reviewed_at AS lastReviewedAt,revoked_at AS revokedAt FROM connected_app_preferences WHERE user_id=? ORDER BY last_reviewed_at DESC,app_id", [userId], selected, offset, limit),
    section(DB, "workSignals", "SELECT id,source_app_id AS sourceAppId,free_text_summary AS summary,canonical_topic_ids_json AS topicIds,canonical_tool_ids_json AS toolIds,canonical_domain_ids_json AS domainIds,canonical_stage_ids_json AS stageIds,canonical_collaboration_intent_ids_json AS collaborationIntentIds,audience,cohort_scope_id AS cohortScopeId,allow_matching AS allowMatching,approved_at AS approvedAt,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt,updated_at AS updatedAt FROM work_signals WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "projects", "SELECT project.id,project.slug,project.title,project.summary,project.audience,project.cohort_scope_id AS cohortScopeId,project.allow_matching AS allowMatching,project.status,project.stage,project.published_at AS publishedAt,project.deleted_at AS deletedAt,project.created_at AS createdAt,project.updated_at AS updatedAt,(SELECT COALESCE(json_group_array(json_object('id',link.id,'label',link.label,'url',link.url,'position',link.position,'createdAt',link.created_at)),'[]') FROM project_links link WHERE link.project_id=project.id) AS links,(SELECT COALESCE(json_group_array(json_object('id',media.id,'assetId',media.asset_id,'altText',media.alt_text,'position',media.position,'createdAt',media.created_at)),'[]') FROM project_media media WHERE media.project_id=project.id) AS media,(SELECT COALESCE(json_group_array(json_object('kind',taxonomy.kind,'taxonomyItemId',taxonomy.taxonomy_item_id,'createdAt',taxonomy.created_at)),'[]') FROM project_taxonomy_items taxonomy WHERE taxonomy.project_id=project.id) AS taxonomy FROM projects project WHERE project.owner_user_id=? ORDER BY project.created_at,project.id", [userId], selected, offset, limit),
    section(DB, "projectUpdates", "SELECT project_update.id,project_update.project_id AS projectId,project_update.author_user_id AS authorUserId,project_update.body,project_update.audience,project_update.created_at AS createdAt,project_update.edited_at AS editedAt FROM project_updates project_update WHERE project_update.project_id IN (SELECT id FROM projects WHERE owner_user_id=?) OR project_update.author_user_id=? ORDER BY project_update.created_at,project_update.id", [userId, userId], selected, offset, limit),
    section(DB, "networkingPulses", "SELECT id,intent_summary AS intentSummary,similar_adjacent AS similarAdjacent,local_global AS localGlobal,serendipity,collaboration_intent_ids_json AS collaborationIntentIds,controls_json AS controls,starts_at AS startsAt,expires_at AS expiresAt,created_at AS createdAt FROM networking_pulses WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "connections", "SELECT connection_id AS connectionId,muted,renewed_relevance_enabled AS renewedRelevanceEnabled,renewed_relevance_acknowledged_at AS renewedRelevanceAcknowledgedAt,created_at AS createdAt,updated_at AS updatedAt FROM connection_sides WHERE user_id=? ORDER BY created_at,connection_id", [userId], selected, offset, limit),
    section(DB, "privateConnectionNotes", "SELECT id,connection_id AS connectionId,body,created_at AS createdAt,updated_at AS updatedAt FROM connection_private_notes WHERE owner_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "authoredRoomMessages", "SELECT id,room_id AS roomId,body,created_at AS createdAt,edited_at AS editedAt,deleted_at AS deletedAt FROM messages WHERE sender_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "authoredCircleMessages", "SELECT id,circle_id AS circleId,body,created_at AS createdAt,edited_at AS editedAt,deleted_at AS deletedAt FROM circle_messages WHERE sender_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "reports", "SELECT id,target_kind AS targetKind,target_id AS targetId,reason_code AS reasonCode,details,status,created_at AS createdAt,updated_at AS updatedAt FROM reports WHERE reporter_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "audit", "SELECT id,action,object_kind AS objectKind,object_id AS objectId,created_at AS createdAt FROM audit_events WHERE actor_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "identityLinks", "SELECT id,provider_channel AS providerChannel,provider_issuer AS providerIssuer,provider_subject AS providerSubject,workspace_scope AS workspaceScope,linked_at AS linkedAt,revoked_at AS revokedAt FROM identity_links WHERE user_id=? ORDER BY linked_at,id", [userId], selected, offset, limit),
    section(DB, "webSessions", "SELECT id,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt,last_seen_at AS lastSeenAt FROM web_sessions WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "introductionBudgets", "SELECT maximum_per_week AS maximumPerWeek,used_this_week AS usedThisWeek,week_started_at AS weekStartedAt FROM introduction_budgets WHERE user_id=?", [userId], selected, offset, limit),
    section(DB, "quietHours", "SELECT timezone,weekday,start_minute AS startMinute,end_minute AS endMinute FROM quiet_hours WHERE user_id=? ORDER BY weekday,start_minute,end_minute", [userId], selected, offset, limit),
    section(DB, "matchingSnoozes", "SELECT id,reason,starts_at AS startsAt,ends_at AS endsAt,created_at AS createdAt FROM matching_snoozes WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "matchingExclusions", "SELECT id,kind,normalized_value AS normalizedValue,created_at AS createdAt FROM matching_exclusions WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "follows", "SELECT target_kind AS targetKind,target_id AS targetId,created_at AS createdAt,revoked_at AS revokedAt FROM follows WHERE follower_user_id=? ORDER BY created_at,target_kind,target_id", [userId], selected, offset, limit),
    section(DB, "watches", "SELECT id,kind,target_id AS targetId,created_at AS createdAt,revoked_at AS revokedAt FROM watches WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "inviteLinks", "SELECT id,kind,target_id AS targetId,recipient_user_id AS recipientUserId,expires_at AS expiresAt,maximum_uses AS maximumUses,use_count AS useCount,revoked_at AS revokedAt,created_at AS createdAt FROM invite_links WHERE creator_user_id=? OR recipient_user_id=? ORDER BY created_at,id", [userId, userId], selected, offset, limit),
    section(DB, "cohortMemberships", "SELECT cohort_id AS cohortId,role,status,joined_at AS joinedAt FROM cohort_memberships WHERE user_id=? ORDER BY cohort_id", [userId], selected, offset, limit),
    section(DB, "generatedSurfaces", "SELECT surface.id,surface.kind,surface.subject_id AS subjectId,surface.published_revision_id AS publishedRevisionId,surface.created_at AS createdAt,surface.updated_at AS updatedAt FROM surfaces surface WHERE surface.owner_user_id=? ORDER BY surface.created_at,surface.id", [userId], selected, offset, limit),
    section(DB, "authoredSurfaceRevisions", "SELECT revision.id,revision.surface_id AS surfaceId,revision.revision_number AS revisionNumber,revision.base_revision_number AS baseRevisionNumber,revision.design_policy_version AS designPolicyVersion,revision.visibility,revision.spec_json AS spec,revision.status,revision.created_at AS createdAt FROM surface_revisions revision WHERE revision.author_user_id=? ORDER BY revision.created_at,revision.id", [userId], selected, offset, limit),
    section(DB, "surfaceAssets", "SELECT id,object_key AS objectKey,content_type AS contentType,byte_size AS byteSize,sha256,created_at AS createdAt,deleted_at AS deletedAt,object_purged_at AS objectPurgedAt FROM surface_assets WHERE owner_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "surfaceAssetUploadGrants", "SELECT content_type AS contentType,expires_at AS expiresAt,created_at AS createdAt,consumed_at AS consumedAt FROM surface_asset_upload_grants WHERE user_id=? ORDER BY created_at,expires_at,content_type", [userId], selected, offset, limit),
    section(DB, "profileProjectMedia", "SELECT project_key AS projectKey,asset_id AS assetId,alt_text AS altText,created_at AS createdAt,updated_at AS updatedAt FROM profile_project_media WHERE profile_id=? ORDER BY project_key", [profileId], selected, offset, limit),
    section(DB, "candidateEvaluations", "SELECT id,proposal_id AS proposalId,decision,index_version AS indexVersion,reason_summary AS reasonSummary,evidence_ids_json AS evidenceIds,created_at AS createdAt FROM codex_evaluations WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "matchResponses", "SELECT id,proposal_id AS proposalId,response,created_at AS createdAt FROM human_responses WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "connectionReminders", "SELECT id,connection_id AS connectionId,remind_at AS remindAt,status,created_at AS createdAt FROM connection_reminders WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "roomMemberships", "SELECT room_id AS roomId,joined_at AS joinedAt,left_at AS leftAt,last_read_message_id AS lastReadMessageId FROM room_memberships WHERE user_id=? ORDER BY joined_at,room_id", [userId], selected, offset, limit),
    section(DB, "introductionFeedback", "SELECT id,connection_id AS connectionId,useful,reasons_json AS reasons,similar_match_preference AS similarMatchPreference,follow_up_intent AS followUpIntent,private_note AS privateNote,created_at AS createdAt FROM introduction_feedback WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "roomUpgradeProposals", "SELECT id,room_id AS roomId,modules_json AS modules,explanation,status,created_at AS createdAt FROM room_upgrade_proposals WHERE proposer_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "meetingProposals", "SELECT id,room_id AS roomId,parent_proposal_id AS parentProposalId,starts_at AS startsAt,ends_at AS endsAt,timezone,note,status,responded_by_user_id AS respondedByUserId,responded_at AS respondedAt,created_at AS createdAt,updated_at AS updatedAt FROM meeting_proposals WHERE proposer_user_id=? OR responded_by_user_id=? ORDER BY created_at,id", [userId, userId], selected, offset, limit),
    section(DB, "availabilityWindows", "SELECT id,room_id AS roomId,starts_at AS startsAt,ends_at AS endsAt,timezone,status,created_at AS createdAt,updated_at AS updatedAt FROM availability_windows WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "circleMemberships", "SELECT circle_id AS circleId,role,status,joined_at AS joinedAt FROM circle_memberships WHERE user_id=? ORDER BY circle_id", [userId], selected, offset, limit),
    section(DB, "circleProposals", "SELECT id,circle_id AS circleId,kind,payload_json AS payload,governance_version AS governanceVersion,status,created_at AS createdAt FROM circle_proposals WHERE proposer_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "circleVotes", "SELECT proposal_id AS proposalId,vote,created_at AS createdAt FROM circle_votes WHERE user_id=? ORDER BY created_at,proposal_id", [userId], selected, offset, limit),
    section(DB, "authoredCircleModuleEntries", "SELECT entry.id,entry.module_id AS moduleId,entry.payload_json AS payload,entry.created_at AS createdAt,entry.updated_at AS updatedAt FROM circle_module_entries entry WHERE entry.author_user_id=? ORDER BY entry.created_at,entry.id", [userId], selected, offset, limit),
    section(DB, "circleMetricEntries", "SELECT id,metric_id AS metricId,value,evidence,period_key AS periodKey,created_at AS createdAt FROM circle_metric_entries WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "notifications", "SELECT id,kind,delivery,payload_json AS payload,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "automation", "SELECT kind,state_json AS state,updated_at AS updatedAt FROM automation_checkpoints WHERE user_id=? ORDER BY updated_at,kind", [userId], selected, offset, limit),
    section(DB, "blocks", "SELECT blocker_user_id AS blockerUserId,blocked_user_id AS blockedUserId,created_at AS createdAt,revoked_at AS revokedAt FROM blocks WHERE blocker_user_id=? ORDER BY created_at,blocked_user_id", [userId], selected, offset, limit),
    section(DB, "moderationAppeals", "SELECT appeal.id,appeal.case_id AS caseId,appeal.statement,appeal.status,appeal.created_at AS createdAt,appeal.decided_at AS decidedAt FROM moderation_appeals appeal WHERE appeal.appellant_user_id=? ORDER BY appeal.created_at,appeal.id", [userId], selected, offset, limit),
    section(DB, "exportJobs", "SELECT id,status,created_at AS createdAt,updated_at AS updatedAt FROM export_jobs WHERE user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
    section(DB, "deletionJobs", "SELECT id,status,requested_at AS requestedAt,completed_at AS completedAt,updated_at AS updatedAt FROM deletion_jobs WHERE user_id=? ORDER BY requested_at,id", [userId], selected, offset, limit),
    section(DB, "setupState", "SELECT completed_steps_json AS completedSteps,updated_at AS updatedAt FROM setup_states WHERE user_id=?", [userId], selected, offset, limit),
    section(DB, "calendarReceipts", "SELECT id,room_id AS roomId,meeting_proposal_id AS meetingProposalId,provider,provider_event_id AS providerEventId,starts_at AS startsAt,ends_at AS endsAt,participant_labels_json AS participantLabels,status,created_at AS createdAt FROM calendar_event_receipts WHERE attached_by_user_id=? ORDER BY created_at,id", [userId], selected, offset, limit),
  ]);

  const pages = { profileFields, profileStatistics, sourcePolicies, workSignals, projects, projectUpdates, networkingPulses, connections, privateConnectionNotes, authoredRoomMessages, authoredCircleMessages, reports, audit, identityLinks, webSessions, introductionBudgets, quietHours, matchingSnoozes, matchingExclusions, follows, watches, inviteLinks, cohortMemberships, generatedSurfaces, authoredSurfaceRevisions, surfaceAssets, surfaceAssetUploadGrants, profileProjectMedia, candidateEvaluations, matchResponses, connectionReminders, roomMemberships, introductionFeedback, roomUpgradeProposals, meetingProposals, availabilityWindows, circleMemberships, circleProposals, circleVotes, authoredCircleModuleEntries, circleMetricEntries, notifications, automation, blocks, moderationAppeals, exportJobs, deletionJobs, setupState, calendarReceipts } satisfies Record<AccountExportSection, SectionPage>;
  const budgeted = options.maxBytes ? applyByteBudget(pages, { userId, handle, profile, generatedAt: new Date(now).toISOString() }, options.maxBytes, offset) : { pages, truncatedSections: [] as AccountExportSection[], oversizedSections: [] as AccountExportSection[] };
  const boundedPages = budgeted.pages;
  const nextPageSections = Object.entries(boundedPages).filter(([, value]) => value.nextCursor).map(([key]) => key as AccountExportSection);
  const incompleteSections = [...new Set([...budgeted.truncatedSections, ...budgeted.oversizedSections, ...nextPageSections])];
  const result = Object.fromEntries(Object.entries(boundedPages).map(([key, value]) => [key, value.items])) as Record<AccountExportSection, unknown[]>;
  const pagination = Object.fromEntries(Object.entries(boundedPages).map(([key, value]) => [key, value.nextCursor])) as Record<AccountExportSection, string | null>;
  // A continuation must not create a new audit row while reading the audit
  // section itself. Otherwise a small page can keep generating its own next
  // cursor forever. The first request is the export initiation event.
  if (!options.section && !options.cursor) await DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES (?,?,?,?,?,'{}',?)").bind(`audit_${crypto.randomUUID()}`, userId, "export.generated", "user", userId, now).run();
  return {
    schema: "buildmates-account-export/v1",
    generatedAt: new Date(now).toISOString(),
    consistency: "live_read_time",
    account: { userId, handle, profile },
    ...result,
    pagination,
    completeness: {
      complete: incompleteSections.length === 0,
      truncatedSections: budgeted.truncatedSections,
      oversizedSections: budgeted.oversizedSections,
      nextPageSections,
      ...(options.maxBytes ? { byteBudget: options.maxBytes } : {}),
      webDownloadPath: "/api/privacy/export",
    },
  };
}

function applyByteBudget<T extends Record<AccountExportSection, SectionPage>>(pages: T, account: { userId: string; handle: unknown; profile: unknown; generatedAt: string }, maxBytes: number, offset: number): { pages: T; truncatedSections: AccountExportSection[]; oversizedSections: AccountExportSection[] } {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 16_384) throw new Error("invalid_export_byte_budget");
  const bounded = Object.fromEntries(Object.entries(pages).map(([key]) => [key, { items: [], nextCursor: null }])) as unknown as T;
  const truncatedSections: AccountExportSection[] = [];
  const oversizedSections: AccountExportSection[] = [];
  const completenessPlaceholder = { complete: false, truncatedSections: Object.keys(pages), oversizedSections: Object.keys(pages), nextPageSections: Object.keys(pages), byteBudget: maxBytes, webDownloadPath: "/api/privacy/export" };
  const payload = (state: T) => {
    const result = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.items]));
    const pagination = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.nextCursor]));
    return { schema: "buildmates-account-export/v1", generatedAt: account.generatedAt, consistency: "live_read_time", account: { userId: account.userId, handle: account.handle, profile: account.profile }, ...result, pagination, completeness: completenessPlaceholder };
  };
  if (byteLength(payload(bounded)) > maxBytes) throw new Error("export_header_too_large");
  for (const [key, page] of Object.entries(pages) as Array<[AccountExportSection, SectionPage]>) {
    const target = bounded[key];
    if (!target) continue;
    let index = 0;
    for (; index < page.items.length; index += 1) {
      target.items.push(page.items[index]);
      if (byteLength(payload(bounded)) > maxBytes) {
        target.items.pop();
        const alone = Object.fromEntries(Object.entries(pages).map(([section]) => [section, { items: section === key ? [page.items[0]] : [], nextCursor: null }])) as unknown as T;
        if (index === 0 && byteLength(payload(alone)) > maxBytes) {
          oversizedSections.push(key);
          target.nextCursor = null;
        } else {
          target.nextCursor = `offset:${offset + index}`;
          truncatedSections.push(key);
        }
        break;
      }
    }
    if (index === page.items.length && page.nextCursor) target.nextCursor = page.nextCursor;
    if (index < page.items.length || target.nextCursor) {
      if (!truncatedSections.includes(key) && index < page.items.length) truncatedSections.push(key);
      continue;
    }
  }
  return { pages: bounded, truncatedSections, oversizedSections };
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

async function section(DB: DB, name: AccountExportSection, sql: string, bindings: unknown[], selected: AccountExportSection | undefined, offset: number, limit: number): Promise<SectionPage> {
  if (selected && selected !== name) return { items: [], nextCursor: null };
  const rows = await DB.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...bindings, limit + 1, offset).all();
  const items = rows.results.slice(0, limit);
  return { items, nextCursor: rows.results.length > limit ? `offset:${offset + limit}` : null };
}

function parseCursor(value: string | undefined): number {
  if (!value) return 0;
  const match = /^offset:(\d+)$/.exec(value.trim());
  if (!match) throw new Error("invalid_export_cursor");
  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_EXPORT_OFFSET) throw new Error("invalid_export_cursor");
  return offset;
}
