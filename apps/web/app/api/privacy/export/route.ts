import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { consumeWebRateLimit } from "@/src/security/rate-limit";

export async function GET() {
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  try {
    await consumeWebRateLimit(DB, "account_export", user.id, 3, 24 * 60 * 60 * 1000);
    const profile = await DB.prepare("SELECT id,display_name AS displayName,summary,project_or_interest AS projectOrInterest,portfolio_links_json AS portfolioLinks,audience,allow_matching AS allowMatching,acceptance_mode AS acceptanceMode,coarse_location AS coarseLocation,location_map_opt_in AS locationMapOptIn,timezone,published_at AS publishedAt,created_at AS createdAt,updated_at AS updatedAt FROM profiles WHERE user_id=?").bind(user.id).first();
    const profileId = (profile as { id?: string } | null)?.id ?? "";
    const rows = await Promise.all([
      DB.prepare("SELECT handle,created_at AS createdAt FROM handles WHERE user_id=?").bind(user.id).first(),
      DB.prepare("SELECT field_key AS fieldKey,value_json AS value,audience,allow_matching AS allowMatching,source_status AS sourceStatus,provenance,updated_at AS updatedAt FROM profile_fields WHERE profile_id=? ORDER BY field_key").bind(profileId).all(),
      DB.prepare("SELECT stat_key AS statKey,label,value,provenance,audience,updated_at AS updatedAt FROM profile_statistics WHERE profile_id=? ORDER BY stat_key").bind(profileId).all(),
      DB.prepare("SELECT id,app_id AS appId,display_name AS displayName,category,access_mode AS accessMode,last_reviewed_at AS lastReviewedAt,revoked_at AS revokedAt FROM connected_app_preferences WHERE user_id=? ORDER BY last_reviewed_at DESC").bind(user.id).all(),
      DB.prepare("SELECT id,source_app_id AS sourceAppId,free_text_summary AS summary,canonical_topic_ids_json AS topicIds,canonical_tool_ids_json AS toolIds,canonical_domain_ids_json AS domainIds,canonical_stage_ids_json AS stageIds,canonical_collaboration_intent_ids_json AS collaborationIntentIds,audience,allow_matching AS allowMatching,approved_at AS approvedAt,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt,updated_at AS updatedAt FROM work_signals WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,slug,title,summary,audience,allow_matching AS allowMatching,status,stage,published_at AS publishedAt,deleted_at AS deletedAt,created_at AS createdAt,updated_at AS updatedAt FROM projects WHERE owner_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,intent_summary AS intentSummary,similar_adjacent AS similarAdjacent,local_global AS localGlobal,serendipity,collaboration_intent_ids_json AS collaborationIntentIds,controls_json AS controls,starts_at AS startsAt,expires_at AS expiresAt,created_at AS createdAt FROM networking_pulses WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT connection_id AS connectionId,muted,renewed_relevance_enabled AS renewedRelevanceEnabled,renewed_relevance_acknowledged_at AS renewedRelevanceAcknowledgedAt,created_at AS createdAt,updated_at AS updatedAt FROM connection_sides WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT connection_id AS connectionId,body,created_at AS createdAt,updated_at AS updatedAt FROM connection_private_notes WHERE owner_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT room_id AS roomId,body,created_at AS createdAt,edited_at AS editedAt,deleted_at AS deletedAt FROM messages WHERE sender_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT circle_id AS circleId,body,created_at AS createdAt,edited_at AS editedAt,deleted_at AS deletedAt FROM circle_messages WHERE sender_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT target_kind AS targetKind,target_id AS targetId,reason_code AS reasonCode,details,status,created_at AS createdAt,updated_at AS updatedAt FROM reports WHERE reporter_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT action,object_kind AS objectKind,object_id AS objectId,created_at AS createdAt FROM audit_events WHERE actor_user_id=? ORDER BY created_at").bind(user.id).all(),
    ]);
    const extendedRows = await Promise.all([
      DB.prepare("SELECT provider_channel AS providerChannel,provider_issuer AS providerIssuer,provider_subject AS providerSubject,workspace_scope AS workspaceScope,linked_at AS linkedAt,revoked_at AS revokedAt FROM identity_links WHERE user_id=? ORDER BY linked_at").bind(user.id).all(),
      DB.prepare("SELECT created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt,last_seen_at AS lastSeenAt FROM web_sessions WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT maximum_per_week AS maximumPerWeek,used_this_week AS usedThisWeek,week_started_at AS weekStartedAt FROM introduction_budgets WHERE user_id=?").bind(user.id).all(),
      DB.prepare("SELECT timezone,weekday,start_minute AS startMinute,end_minute AS endMinute FROM quiet_hours WHERE user_id=? ORDER BY weekday,start_minute").bind(user.id).all(),
      DB.prepare("SELECT reason,starts_at AS startsAt,ends_at AS endsAt,created_at AS createdAt FROM matching_snoozes WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT kind,normalized_value AS normalizedValue,created_at AS createdAt FROM matching_exclusions WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT target_kind AS targetKind,target_id AS targetId,created_at AS createdAt,revoked_at AS revokedAt FROM follows WHERE follower_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,kind,target_id AS targetId,created_at AS createdAt,revoked_at AS revokedAt FROM watches WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,kind,target_id AS targetId,recipient_user_id AS recipientUserId,expires_at AS expiresAt,maximum_uses AS maximumUses,use_count AS useCount,revoked_at AS revokedAt,created_at AS createdAt FROM invite_links WHERE creator_user_id=? OR recipient_user_id=? ORDER BY created_at").bind(user.id,user.id).all(),
      DB.prepare("SELECT cohort_id AS cohortId,role,status,joined_at AS joinedAt FROM cohort_memberships WHERE user_id=?").bind(user.id).all(),
      DB.prepare("SELECT surface.id,surface.kind,surface.subject_id AS subjectId,surface.published_revision_id AS publishedRevisionId,surface.created_at AS createdAt,surface.updated_at AS updatedAt FROM surfaces surface WHERE surface.owner_user_id=? ORDER BY surface.created_at").bind(user.id).all(),
      DB.prepare("SELECT revision.id,revision.surface_id AS surfaceId,revision.revision_number AS revisionNumber,revision.base_revision_number AS baseRevisionNumber,revision.design_policy_version AS designPolicyVersion,revision.visibility,revision.spec_json AS spec,revision.status,revision.created_at AS createdAt FROM surface_revisions revision WHERE revision.author_user_id=? ORDER BY revision.created_at").bind(user.id).all(),
      DB.prepare("SELECT id,object_key AS objectKey,content_type AS contentType,byte_size AS byteSize,sha256,created_at AS createdAt,deleted_at AS deletedAt FROM surface_assets WHERE owner_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT project_key AS projectKey,asset_id AS assetId,alt_text AS altText,created_at AS createdAt,updated_at AS updatedAt FROM profile_project_media WHERE profile_id=? ORDER BY project_key").bind(profileId).all(),
      DB.prepare("SELECT proposal_id AS proposalId,decision,index_version AS indexVersion,reason_summary AS reasonSummary,evidence_ids_json AS evidenceIds,created_at AS createdAt FROM codex_evaluations WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT proposal_id AS proposalId,response,created_at AS createdAt FROM human_responses WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT connection_id AS connectionId,remind_at AS remindAt,status,created_at AS createdAt FROM connection_reminders WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT room_id AS roomId,joined_at AS joinedAt,left_at AS leftAt,last_read_message_id AS lastReadMessageId FROM room_memberships WHERE user_id=? ORDER BY joined_at").bind(user.id).all(),
      DB.prepare("SELECT connection_id AS connectionId,useful,reasons_json AS reasons,similar_match_preference AS similarMatchPreference,follow_up_intent AS followUpIntent,private_note AS privateNote,created_at AS createdAt FROM introduction_feedback WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,room_id AS roomId,modules_json AS modules,explanation,status,created_at AS createdAt FROM room_upgrade_proposals WHERE proposer_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT entry.id,entry.module_id AS moduleId,entry.payload_json AS payload,entry.created_at AS createdAt,entry.updated_at AS updatedAt,entry.deleted_at AS deletedAt FROM room_module_entries entry WHERE entry.author_user_id=? ORDER BY entry.created_at").bind(user.id).all(),
      DB.prepare("SELECT id,room_id AS roomId,parent_proposal_id AS parentProposalId,starts_at AS startsAt,ends_at AS endsAt,timezone,note,status,responded_by_user_id AS respondedByUserId,responded_at AS respondedAt,created_at AS createdAt,updated_at AS updatedAt FROM meeting_proposals WHERE proposer_user_id=? OR responded_by_user_id=? ORDER BY created_at").bind(user.id,user.id).all(),
      DB.prepare("SELECT id,room_id AS roomId,starts_at AS startsAt,ends_at AS endsAt,timezone,status,created_at AS createdAt,updated_at AS updatedAt FROM availability_windows WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT circle_id AS circleId,role,status,joined_at AS joinedAt FROM circle_memberships WHERE user_id=?").bind(user.id).all(),
      DB.prepare("SELECT id,circle_id AS circleId,kind,payload_json AS payload,governance_version AS governanceVersion,status,created_at AS createdAt FROM circle_proposals WHERE proposer_user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT proposal_id AS proposalId,vote,created_at AS createdAt FROM circle_votes WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT entry.id,entry.module_id AS moduleId,entry.payload_json AS payload,entry.created_at AS createdAt,entry.updated_at AS updatedAt FROM circle_module_entries entry WHERE entry.author_user_id=? ORDER BY entry.created_at").bind(user.id).all(),
      DB.prepare("SELECT id,metric_id AS metricId,value,evidence,period_key AS periodKey,created_at AS createdAt FROM circle_metric_entries WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,kind,delivery,payload_json AS payload,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT kind,state_json AS state,updated_at AS updatedAt FROM automation_checkpoints WHERE user_id=? ORDER BY updated_at").bind(user.id).all(),
      DB.prepare("SELECT blocker_user_id AS blockerUserId,blocked_user_id AS blockedUserId,created_at AS createdAt,revoked_at AS revokedAt FROM blocks WHERE blocker_user_id=? OR blocked_user_id=? ORDER BY created_at").bind(user.id,user.id).all(),
      DB.prepare("SELECT appeal.id,appeal.case_id AS caseId,appeal.statement,appeal.status,appeal.created_at AS createdAt,appeal.decided_at AS decidedAt FROM moderation_appeals appeal WHERE appeal.appellant_user_id=? ORDER BY appeal.created_at").bind(user.id).all(),
      DB.prepare("SELECT id,status,created_at AS createdAt,updated_at AS updatedAt FROM export_jobs WHERE user_id=? ORDER BY created_at").bind(user.id).all(),
      DB.prepare("SELECT id,status,requested_at AS requestedAt,completed_at AS completedAt,updated_at AS updatedAt FROM deletion_jobs WHERE user_id=? ORDER BY requested_at").bind(user.id).all(),
      DB.prepare("SELECT completed_steps_json AS completedSteps,updated_at AS updatedAt FROM setup_states WHERE user_id=?").bind(user.id).all(),
      DB.prepare("SELECT id,room_id AS roomId,meeting_proposal_id AS meetingProposalId,provider,provider_event_id AS providerEventId,starts_at AS startsAt,ends_at AS endsAt,participant_labels_json AS participantLabels,status,created_at AS createdAt FROM calendar_event_receipts WHERE attached_by_user_id=? ORDER BY created_at").bind(user.id).all(),
    ]);
    const [handle, fields, statistics, sources, signals, projects, pulses, connections, privateNotes, roomMessages, circleMessages, reports, audit] = rows;
    const [identityLinks,webSessions,introductionBudgets,quietHours,matchingSnoozes,matchingExclusions,follows,watches,inviteLinks,cohortMemberships,surfaces,surfaceRevisions,surfaceAssets,profileProjectMedia,codexEvaluations,humanResponses,connectionReminders,roomMemberships,introductionFeedback,roomUpgradeProposals,meetingProposals,availabilityWindows,circleMemberships,circleProposals,circleVotes,circleModuleEntries,circleMetricEntries,notifications,automation,blocks,moderationAppeals,exportJobs,deletionJobs,setupStates,calendarReceipts] = extendedRows;
    const payload = {
      schema: "buildmates-account-export/v1",
      generatedAt: new Date().toISOString(),
      account: { userId: user.id, handle, profile },
      profileFields: fields.results,
      profileStatistics: statistics.results,
      sourcePolicies: sources.results,
      workSignals: signals.results,
      projects: projects.results,
      networkingPulses: pulses.results,
      connections: connections.results,
      privateConnectionNotes: privateNotes.results,
      authoredRoomMessages: roomMessages.results,
      authoredCircleMessages: circleMessages.results,
      reports: reports.results,
      audit: audit.results,
      identityLinks: identityLinks.results,
      webSessions: webSessions.results,
      networkingControls: { introductionBudgets: introductionBudgets.results, quietHours: quietHours.results, snoozes: matchingSnoozes.results, exclusions: matchingExclusions.results },
      follows: follows.results,
      watches: watches.results,
      inviteLinks: inviteLinks.results,
      cohortMemberships: cohortMemberships.results,
      generatedSurfaces: surfaces.results,
      authoredSurfaceRevisions: surfaceRevisions.results,
      surfaceAssets: surfaceAssets.results,
      profileProjectMedia: profileProjectMedia.results,
      candidateEvaluations: codexEvaluations.results,
      matchResponses: humanResponses.results,
      connectionReminders: connectionReminders.results,
      roomMemberships: roomMemberships.results,
      introductionFeedback: introductionFeedback.results,
      roomUpgradeProposals: roomUpgradeProposals.results,
      meetingProposals: meetingProposals.results,
      availabilityWindows: availabilityWindows.results,
      circleMemberships: circleMemberships.results,
      circleProposals: circleProposals.results,
      circleVotes: circleVotes.results,
      authoredCircleModuleEntries: circleModuleEntries.results,
      circleMetricEntries: circleMetricEntries.results,
      notifications: notifications.results,
      automation: automation.results,
      blocks: blocks.results,
      moderationAppeals: moderationAppeals.results,
      exportJobs: exportJobs.results,
      deletionJobs: deletionJobs.results,
      setupState: setupStates.results,
      calendarReceipts: calendarReceipts.results,
    };
    await DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES (?,?,?,?,?,'{}',?)")
      .bind(`audit_${crypto.randomUUID()}`, user.id, "export.downloaded", "user", user.id, Date.now()).run();
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="buildmates-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("privacy_export_failed", error instanceof Error ? error.message : "unknown_error");
    const rateLimited = error instanceof Error && error.message === "rate_limited";
    return Response.json({ error: rateLimited ? "rate_limited" : "export_failed" }, { status: rateLimited ? 429 : 500 });
  }
}
