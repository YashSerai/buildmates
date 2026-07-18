import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CANONICAL_CITIES, getSetupState, completeSetupStep, resolveCanonicalCity, type SetupProgress } from "@buildmates/domain";
import { activeSurfaceSpecSchema, DESIGN_POLICY_ID, DESIGN_POLICY_SOURCE_HASH, DESIGN_POLICY_VERSION, safeParseSurfaceSpec, type SurfaceSpec } from "@buildmates/surfaces";
import { canonicalToolInputHash } from "./tool-hash";
import { z } from "zod";
import type { McpProductRepository, McpRecord } from "./repository";
import {
  idSchema, idempotencyKeySchema, isoDateSchema, networkingPulseSchema,
  profileModelSchema, setupPayloadSchema, sourcePolicySchema, summarySchema,
  workSignalSchema, workspaceScopeSchema,
} from "./schemas";
import type { CompleteIdentityLinkResult } from "./tools/identity";

export type BuildmatesToolServices = {
  linkBaseUrl: string;
  repository: McpProductRepository;
  completeIdentityLink(input: { mcpSubject: string; code: string; workspaceScope: string }): Promise<CompleteIdentityLinkResult>;
  allowAttempt(input: { mcpSubject: string; operation: string }): Promise<boolean>;
  resolveLinkedUser(input: { mcpSubject: string; workspaceScope: string }): Promise<{ userId: string } | null>;
  validateTaxonomy(input: { taxonomyVersion: string; topicIds: string[]; toolIds: string[]; domainIds: string[]; stageIds: string[]; collaborationIntentIds: string[] }): Promise<boolean>;
  executeRemoteTool?(input: { name: string; input: unknown; mcpSubject: string }): Promise<unknown>;
  recordAutomationCapabilityProof?(input: { userId: string; now: string }): Promise<{ capability: "available"; checkedAt: string; expiresAt: string }>;
  getCandidateShortlist?(input: { userId: string; batchId?: string; limit: number; now: string }): Promise<{
    batchId: string | null;
    expiresAt: string | null;
    candidates: Array<{ userId: string; displayName: string; summary: string; indexVersion: number; taxonomyVersion: number; visibleReasons: string[]; visibleEvidenceIds: string[]; proposalId: string | null }>;
  }>;
  recordCandidateEvaluation?(input: { userId: string; evaluationId: string; batchId: string; candidateUserId: string; decision: "approve" | "decline" | "defer"; reasonSummary: string; evidenceIds: string[]; indexVersion: number; now: string }): Promise<{ evaluationId: string; proposalId: string; state: string; connectionId: string | null; roomId: string | null }>;
  recordManualMatchResponse?(input: { userId: string; responseId: string; proposalId: string; response: "interested" | "decline"; now: string }): Promise<{ responseId: string; state: string; connectionId: string | null; roomId: string | null }>;
  now?: () => Date;
  createId?: () => string;
};

type ToolContext = { mcpSubject: string; userId: string | null; workspaceScope: string };
type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  input: z.ZodType;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  preLink?: boolean;
  consequential?: boolean;
  execute(input: Record<string, unknown>, context: ToolContext, services: BuildmatesToolServices): Promise<unknown>;
};

const workspaceInput = { workspaceScope: workspaceScopeSchema };
const pageInput = { cursor: idSchema.optional(), limit: z.number().int().min(1).max(50).default(20), ...workspaceInput };
const mutate = { idempotencyKey: idempotencyKeySchema, ...workspaceInput };
const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const deleteAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

export const buildmatesToolRegistry: readonly ToolDefinition[] = [
  tool("get_link_url", "Get identity link URL", "Returns the HTTPS Buildmates sign-in and one-time approval-code page for this OAuth principal. It exposes no user data.", z.object(workspaceInput).strict(), readAnnotations, async (_, context, services) => ({ url: new URL("/settings/connections", services.linkBaseUrl).toString(), workspaceScope: context.workspaceScope }), true),
  tool("complete_identity_link", "Complete identity link", "Uses a short-lived, one-time approval code to connect this Codex app to the signed-in Buildmates account. No account data is available before linking.", z.object({ code: z.string().trim().regex(/^[A-F0-9]{32}$/), ...workspaceInput }).strict(), { ...writeAnnotations, idempotentHint: false }, async (input, context, services) => {
    if (!(await services.allowAttempt({ mcpSubject: context.mcpSubject, operation: "complete_identity_link" }))) return { linked: false, reason: "rate_limited" };
    return services.completeIdentityLink({ mcpSubject: context.mcpSubject, code: input.code as string, workspaceScope: context.workspaceScope });
  }, true),

  tool("get_setup_state", "Get setup state", "Returns the visible, resumable first-run finish line and next incomplete step. Before identity linking it safely returns identity_link as the next step and exposes no user data.", z.object(workspaceInput).strict(), readAnnotations, async (_, context, services) => {
    const linked = await services.resolveLinkedUser({ mcpSubject: context.mcpSubject, workspaceScope: context.workspaceScope });
    if (!linked) return setupStateWithGuidance(getSetupState());
    const record = await services.repository.readForMember<SetupProgress>("setup", linked.userId, linked.userId);
    return setupStateWithGuidance(getSetupState(linkedSetupProgress(record?.value, services)));
  }, true),
  tool("complete_setup_step", "Complete setup step", "Completes exactly the next mandatory setup step after validating its step-specific evidence.", z.object({ payload: setupPayloadSchema, ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "complete_setup_step", input, async () => {
    const current = await services.repository.readForMember<SetupProgress>("setup", context.userId!, context.userId!);
    const payload = input.payload as z.infer<typeof setupPayloadSchema>;
    await verifySetupEvidence(payload, context.userId!, services);
    if (payload.step === "acceptance_mode") {
      const profile = (await services.repository.listForMember<Record<string, unknown>>("profile_model", context.userId!))[0];
      if (!profile) throw new Error("setup_evidence_missing");
      await services.repository.write({ kind: "profile_model", id: profile.id, ownerUserId: context.userId!, actorUserId: context.userId!, value: { ...profile.value, acceptanceMode: payload.mode }, now: now(services) });
    }
    if (payload.step === "automation") {
      const checkpoint = (await services.repository.listForMember<Record<string, unknown>>("automation_checkpoint", context.userId!))[0];
      if (!checkpoint) throw new Error("setup_evidence_missing");
      await services.repository.write({ kind: "automation_checkpoint", id: checkpoint.id, ownerUserId: context.userId!, actorUserId: context.userId!, value: { ...checkpoint.value, enabled: payload.enabled, cadence: payload.cadence }, now: now(services) });
    }
    const state = completeSetupStep(linkedSetupProgress(current?.value, services), payload.step, now(services));
    await services.repository.write({ kind: "setup", id: context.userId!, ownerUserId: context.userId!, value: state, now: now(services) });
    return { confirmationState: "completed", setup: state };
  })),

  tool("get_source_preferences", "Get source-use policies", "Lists Buildmates-only source-use policies. This list is non-exhaustive and does not change host connector permissions.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("source_policy", context.userId!, pageOptions(input)); return { exhaustive: false, policies: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("save_source_preference", "Save source-use policy", "Saves a Buildmates-only policy for a confidently visible or user-named source. Ask each time can approve one next signal; Allow approved Work Signals permits recurring extraction until changed. This never changes host or provider permissions.", z.object({ sourceId: idSchema, displayName: z.string().trim().min(1).max(100), category: z.enum(["projects_code", "documents_designs", "communities_messaging", "calendar", "email", "hackathons_cohorts", "other"]), policy: sourcePolicySchema, supportsActions: z.boolean(), approveNextWorkSignal: z.boolean().default(false), sourceOrigin: z.enum(["current_conversation", "declared_optional_dependency", "user_named"]), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "save_source_preference", input, async () => {
    if (input.policy === "actions_only" && input.supportsActions !== true) throw new Error("source_actions_unsupported");
    const saved = await services.repository.write({ kind: "source_policy", id: input.sourceId as string, ownerUserId: context.userId!, value: withoutRuntime(input), now: now(services) });
    return confirmed(saved);
  })),

  tool("list_work_signals", "List approved Work Signals", "Lists only the linked user's approved structured summaries; raw connector content is never returned.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("work_signal", context.userId!, pageOptions(input)); return { signals: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("submit_work_signal", "Submit permitted Work Signal", "Stores a concise summary used only for matching, along with approved topics and tools. Ask each time requires a one-time approval. Raw prompts, chats, documents, repository contents, email bodies, calendar contents, and credentials are not accepted.", z.object({ signal: workSignalSchema, ...workspaceInput }).strict(), writeAnnotations, async (input, context, services) => {
    const signal = input.signal as z.infer<typeof workSignalSchema>;
    const source = await services.repository.readForMember<Record<string, unknown>>("source_policy", signal.sourceId, context.userId!);
    const policy = source?.value.policy;
    if (!source || policy === "never" || policy === "actions_only") throw new Error("source_policy_denied");
    if (policy === "ask_each_time" && !signal.sourceApprovalId) throw new Error("source_approval_required");
    if (!(await services.validateTaxonomy({ taxonomyVersion: signal.taxonomyVersion, topicIds: signal.canonicalTopicIds, toolIds: signal.canonicalToolIds, domainIds: signal.canonicalDomainIds, stageIds: signal.canonicalStageIds, collaborationIntentIds: signal.canonicalCollaborationIntentIds }))) throw new Error("taxonomy_identifiers_invalid");
    return idempotent(context, services, "submit_work_signal", { ...signal, workspaceScope: context.workspaceScope }, async () => confirmed(await services.repository.write({ kind: "work_signal", id: signal.signalId, ownerUserId: context.userId!, value: signal, now: now(services) })));
  }),

  tool("get_networking_pulse", "Get Networking Pulse", "Returns the user's current expiring networking intent and controls.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("networking_pulse", context.userId!, pageOptions(input)); return { pulses: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("update_networking_pulse", "Update Networking Pulse", "Stores expiring intent, introduction limits, quiet hours, snooze, serendipity, and exclusions.", z.object({ pulse: networkingPulseSchema, ...workspaceInput }).strict(), writeAnnotations, async (input, context, services) => {
    const pulse = input.pulse as z.infer<typeof networkingPulseSchema>;
    if (Date.parse(pulse.expiresAt) <= Date.parse(pulse.startsAt)) throw new Error("pulse_expiry_invalid");
    return idempotent(context, services, "update_networking_pulse", pulse, async () => confirmed(await services.repository.write({ kind: "networking_pulse", id: pulse.pulseId, ownerUserId: context.userId!, value: pulse, now: now(services) })));
  }),

  tool("get_profile_model", "Get profile model", "Returns the linked user's structured profile model and publication controls.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("profile_model", context.userId!, pageOptions(input)); return { profiles: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("list_map_cities", "List supported Map cities", "Returns the city choices available for optional participation in the anonymous aggregate Map. It contains no user data.", z.object(workspaceInput).strict(), readAnnotations, async () => ({ cities: CANONICAL_CITIES.map(({ id, label, country }) => ({ id, label, country })) })),
  tool("update_profile_model", "Save reviewed profile draft", "Stores a complete user-reviewed profile draft, including confirmed interests, ambitions, meeting intent, and private design preferences. Public audience is only an intended visibility setting; the profile is not published until its generated page is approved.", z.object({ profile: profileModelSchema, ...workspaceInput }).strict(), writeAnnotations, async (input, context, services) => {
    const profile = input.profile as z.infer<typeof profileModelSchema>;
    const city = resolveCanonicalCity(profile.coarseLocation);
    if (profile.locationMapOptIn && !city) throw new Error("map_city_required");
    const normalizedProfile = { ...profile, coarseLocation: city?.label ?? profile.coarseLocation };
    return idempotent(context, services, "update_profile_model", profile, async () => {
      const saved = confirmed(await services.repository.write({ kind: "profile_model", id: profile.profileId, ownerUserId: context.userId!, value: normalizedProfile, now: now(services) }));
      return { ...saved, surfaceId: (saved.details as Record<string, unknown>).surfaceId ?? null };
    });
  }),

  tool("create_invite_link", "Create invite link", "Creates a revocable personal, builder-profile, or project connection-card invite. Builder and connection-card invites require an owned target.", z.object({ inviteId: idSchema, kind: z.enum(["personal", "builder", "connection_card"]), targetId: idSchema.optional(), headline: z.string().trim().min(1).max(180), expiresAt: isoDateSchema, maximumUses: z.number().int().min(1).max(1000), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "create_invite_link", input, async () => {if(input.kind==="personal"&&input.targetId)throw new Error("invalid_invite_target");if(input.kind!=="personal"&&!input.targetId)throw new Error("invalid_invite_target");return confirmed(await services.repository.write({ kind: "invite", id: input.inviteId as string, ownerUserId: context.userId!, value: { ...withoutRuntime(input), status: "active", uses: 0 }, now: now(services) }))})),
  tool("revoke_invite_link", "Revoke invite link", "Revokes an invite owned by the linked user.", z.object({ inviteId: idSchema, ...mutate }).strict(), deleteAnnotations, async (input, context, services) => idempotent(context, services, "revoke_invite_link", input, async () => ({ confirmationState: (await services.repository.deleteForOwner("invite", input.inviteId as string, context.userId!)) ? "revoked" : "not_found" }))),
  tool("set_follow_or_watch", "Set follow or watch", "Creates or removes an authorized follow for a visible profile, project, or topic, or toggles the single relevant-builder network watch.", z.discriminatedUnion("relation", [
    z.object({ relationId: idSchema, relation: z.literal("follow"), targetKind: z.enum(["profile", "project", "topic"]), targetId: idSchema, enabled: z.boolean(), ...mutate }).strict(),
    z.object({ relationId: idSchema, relation: z.literal("watch"), targetKind: z.literal("relevant_builder"), targetId: z.literal("network"), enabled: z.boolean(), ...mutate }).strict(),
  ]), { ...writeAnnotations, destructiveHint: true }, async (input, context, services) => idempotent(context, services, "set_follow_or_watch", input, async () => {
    return confirmed(await services.repository.write({ kind: "follow_watch", id: input.relationId as string, ownerUserId: context.userId!, value: withoutRuntime(input), now: now(services) }));
  })),
  tool("get_follows_and_watches", "Get follows and relevance watch", "Returns the linked user's active follows and whether scheduled relevance checks are enabled. It does not run a check or send an instant notification.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("follow_watch", context.userId!, pageOptions(input)); return { choices: page.records.map(value), nextCursor: page.nextCursor }; }),

  tool("get_candidate_shortlist", "Get candidate shortlist", "Creates or refreshes a bounded, viewer-authorized candidate batch for user-side evaluation. Each candidate includes only approved display context and any existing proposal identifier.", z.object({ batchId: idSchema.optional(), limit: z.number().int().min(1).max(30).default(30), ...workspaceInput }).strict(), readAnnotations, async (input, context, services) => {
    if (!services.getCandidateShortlist) throw new Error("matching_service_unavailable");
    return services.getCandidateShortlist({ userId: context.userId!, batchId: input.batchId as string | undefined, limit: input.limit as number, now: now(services) });
  }),
  tool("record_candidate_evaluation", "Record candidate evaluation", "Records this user's independent decision for one authorized candidate. An approval can open a room immediately when the other user already approved and both stored acceptance modes allow Full Autopilot.", z.object({ evaluationId: idSchema, batchId: idSchema, candidateUserId: idSchema, decision: z.enum(["approve", "decline", "defer"]), reasonSummary: summarySchema, evidenceIds: z.array(idSchema).max(30).default([]), indexVersion: z.number().int().nonnegative(), confirmation: z.literal("confirmed"), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "record_candidate_evaluation", input, async () => {
    if (!services.recordCandidateEvaluation) throw new Error("matching_service_unavailable");
    return services.recordCandidateEvaluation({ userId: context.userId!, evaluationId: input.evaluationId as string, batchId: input.batchId as string, candidateUserId: input.candidateUserId as string, decision: input.decision as "approve" | "decline" | "defer", reasonSummary: input.reasonSummary as string, evidenceIds: input.evidenceIds as string[], indexVersion: input.indexVersion as number, now: now(services) });
  }), false, true),
  tool("record_manual_match_response", "Record manual match response", "Records an explicit Interested or decline response for this user only.", z.object({ responseId: idSchema, proposalId: idSchema, response: z.enum(["interested", "decline"]), confirmation: z.literal("confirmed"), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "record_manual_match_response", input, async () => {
    if (!services.recordManualMatchResponse) throw new Error("matching_service_unavailable");
    return services.recordManualMatchResponse({ userId: context.userId!, responseId: input.responseId as string, proposalId: input.proposalId as string, response: input.response as "interested" | "decline", now: now(services) });
  }), false, true),

  tool("get_connections", "Get Connections", "Returns persistent Connections visible to the linked member.", z.object({ connectionId: idSchema.optional(), ...pageInput }).strict(), readAnnotations, async (input, context, services) => { if (input.connectionId) return { connections: [value(await requiredRecord(services, "connection", input.connectionId as string, context.userId!))], nextCursor: null }; const page = await services.repository.listPageForMember("connection", context.userId!, pageOptions(input)); return { connections: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("update_connection", "Update Connection", "Updates only this member's mute, renewed-relevance, acknowledgement, or end state for an authorized Connection. Ended Connections require a new mutual reconnect handshake and cannot be reactivated here.", z.object({ connectionId: idSchema, muted: z.boolean().optional(), renewedRelevanceEnabled: z.boolean().optional(), renewedRelevanceAcknowledgedAt: isoDateSchema.optional(), state: z.literal("ended").optional(), ...mutate }).strict(), { ...writeAnnotations, destructiveHint: true }, async (input, context, services) => idempotent(context, services, "update_connection", input, async () => {
    const connection = await requiredRecord<Record<string, unknown>>(services, "connection", input.connectionId as string, context.userId!);
    const previousSide = ((connection.value.sides as Record<string, Record<string, unknown>> | undefined) ?? {})[context.userId!] ?? {};
    const sides = { ...((connection.value.sides as Record<string, unknown> | undefined) ?? {}), [context.userId!]: { ...previousSide, ...(input.muted === undefined ? {} : { muted: input.muted }), ...(input.renewedRelevanceEnabled === undefined ? {} : { renewedRelevanceEnabled: input.renewedRelevanceEnabled }), ...(input.renewedRelevanceAcknowledgedAt === undefined ? {} : { renewedRelevanceAcknowledgedAt: input.renewedRelevanceAcknowledgedAt }) } };
    const saved = await services.repository.write({ kind: "connection", id: connection.id, ownerUserId: connection.ownerUserId, actorUserId: context.userId!, memberUserIds: connection.memberUserIds, value: { ...connection.value, sides, ...(input.state ? { state: input.state } : {}) }, expectedVersion: connection.version, now: now(services) });
    return confirmed(saved);
  })),
  tool("save_connection_private_note", "Save private Connection note", "Stores a note visible only to its author, never to the other Connection member.", z.object({ noteId: idSchema, connectionId: idSchema, body: z.string().trim().min(1).max(4000), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "save_connection_private_note", input, async () => {
    await requiredRecord(services, "connection", input.connectionId as string, context.userId!);
    return confirmed(await services.repository.write({ kind: "connection_private_note", id: input.noteId as string, ownerUserId: context.userId!, value: { connectionId: input.connectionId, body: input.body }, now: now(services) }));
  })),
  tool("get_connection_private_notes", "Get private Connection notes", "Returns only notes authored by the linked user for an authorized Connection.", z.object({ connectionId: idSchema, ...pageInput }).strict(), readAnnotations, async (input, context, services) => {
    await requiredRecord(services, "connection", input.connectionId as string, context.userId!);
    const page = await services.repository.listPageForMember<Record<string, unknown>>("connection_private_note", context.userId!, pageOptions(input, String(input.connectionId))); return { notes: page.records.map(value), nextCursor: page.nextCursor };
  }),
  tool("schedule_connection_reminder", "Schedule Connection reminder", "Schedules a private reminder for the linked member.", z.object({ reminderId: idSchema, connectionId: idSchema, remindAt: isoDateSchema, ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "schedule_connection_reminder", input, async () => {
    await requiredRecord(services, "connection", input.connectionId as string, context.userId!);
    return confirmed(await services.repository.write({ kind: "connection_reminder", id: input.reminderId as string, ownerUserId: context.userId!, value: { connectionId: input.connectionId, remindAt: input.remindAt, status: "scheduled" }, now: now(services) }));
  })),
  tool("get_connection_reminders", "Get Connection reminders", "Returns only the linked user's reminders for an authorized Connection.", z.object({ connectionId: idSchema, ...pageInput }).strict(), readAnnotations, async (input, context, services) => {
    await requiredRecord(services, "connection", input.connectionId as string, context.userId!);
    const page = await services.repository.listPageForMember<Record<string, unknown>>("connection_reminder", context.userId!, pageOptions(input, String(input.connectionId))); return { reminders: page.records.map(value), nextCursor: page.nextCursor };
  }),

  tool("get_room_summaries", "Get room summaries", "Returns audience-filtered summaries for rooms where the linked user is an active member.", z.object({ roomId: idSchema.optional(), ...pageInput }).strict(), readAnnotations, async (input, context, services) => { if (input.roomId) return { rooms: [value(await requiredRecord(services, "room", input.roomId as string, context.userId!))], nextCursor: null }; const page = await services.repository.listPageForMember("room", context.userId!, pageOptions(input)); return { rooms: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("get_circle_summaries", "Get Circle summaries", "Returns summaries for Circles where the linked user is an active member.", z.object({ circleId: idSchema.optional(), ...pageInput }).strict(), readAnnotations, async (input, context, services) => { if (input.circleId) return { circles: [value(await requiredRecord(services, "circle", input.circleId as string, context.userId!))], nextCursor: null }; const page = await services.repository.listPageForMember("circle", context.userId!, pageOptions(input)); return { circles: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("submit_intro_feedback", "Submit introduction feedback", "Stores structured private feedback used to improve this user's future matching preferences.", z.object({ feedbackId: idSchema, connectionId: idSchema, useful: z.boolean(), reasons: z.array(z.enum(["relevant_work", "shared_ambition", "good_conversation", "timing", "not_relevant", "other"])).min(1).max(6), preferenceSummary: z.string().trim().max(500).default(""), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "submit_intro_feedback", input, async () => {
    await requiredRecord(services, "connection", input.connectionId as string, context.userId!);
    return confirmed(await services.repository.write({ kind: "intro_feedback", id: input.feedbackId as string, ownerUserId: context.userId!, value: withoutRuntime(input), now: now(services) }));
  })),

  tool("get_surface_generation_brief", "Get surface generation brief", "Returns the current Design Policy, authorized bindings, governance, base revision, accessibility rules, and privacy boundary before generation.", z.object({ surfaceId: idSchema, ...workspaceInput }).strict(), readAnnotations, async (input, context, services) => {
    const surface = await services.repository.readForMember<Record<string, unknown>>("surface", input.surfaceId as string, context.userId!);
    if (!surface || !surfaceBriefIsComplete(surface.value, context.userId!)) throw new Error("surface_brief_unavailable");
    return { surfaceId: surface.id, kind: surface.value.kind, designPolicy: { id: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION, sourceHash: DESIGN_POLICY_SOURCE_HASH, trustedComponents: surface.value.trustedComponents }, allowedModules: surface.value.allowedModules, authorizedBindings: surface.value.authorizedBindings, authorizedBindingTypes: surface.value.authorizedBindingTypes ?? null, governance: surface.value.governance, baseRevision: surface.value.publishedRevisionId ?? null, starterSpec: starterSurfaceSpec(String(surface.value.kind)), constraints: { scripts: false, forms: false, arbitraryNetworkRequests: false, reducedMotion: "required", privacy: "server_resolved_bindings_only" }, nextAction: "Customize starterSpec using only authorized bindings, validate it, then submit a private preview." };
  }),
  tool("validate_surface_spec", "Validate generated page", "Validates a generated SurfaceSpec without saving it and returns exact field-level problems. Start from the generation brief's starterSpec.", z.object({ surfaceId: idSchema, spec: z.unknown(), ...workspaceInput }).strict(), readAnnotations, async (input, context, services) => {
    const surface = await requiredRecord<Record<string, unknown>>(services, "surface", input.surfaceId as string, context.userId!);
    const parsed = safeParseSurfaceSpec(input.spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
    const kindMatches = parsed.success && parsed.data.kind === surface.value.kind;
    const bindingsAllowed = parsed.success && surfaceBindingsAllowed(parsed.data, surface.value.authorizedBindings);
    if (parsed.success && kindMatches && bindingsAllowed) return { valid: true, issues: [] };
    const issues = parsed.success ? [!kindMatches ? { path: "kind", message: `Expected ${String(surface.value.kind)}` } : null, !bindingsAllowed ? { path: "bindingManifest", message: "A binding is not authorized for this page" } : null].filter(Boolean) : parsed.error.issues.slice(0, 30).map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return { valid: false, issues, recovery: "Start again from starterSpec returned by get_surface_generation_brief and change only theme, layout, fallbacks, and authorized bindings." };
  }),
  tool("submit_surface_revision", "Submit SurfaceSpec revision", "Validates and stores a private SurfaceSpec revision against the current Design Policy. Use get_surface_generation_brief.starterSpec and validate_surface_spec first. Generated code cannot execute scripts or authorize data access.", z.object({ revisionId: idSchema, surfaceId: idSchema, baseRevisionId: idSchema.nullable(), spec: activeSurfaceSpecSchema, visibility: z.enum(["private_preview", "personal_view"]), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "submit_surface_revision", input, async () => {
    const surface = await requiredRecord(services, "surface", input.surfaceId as string, context.userId!);
    const parsed = safeParseSurfaceSpec(input.spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
    if (!parsed.success) throw new Error("surface_spec_invalid");
    const surfaceValue = surface.value as Record<string, unknown>;
    if (parsed.data.kind !== surfaceValue.kind || (surfaceValue.authorizedBindingTypes && !surfaceBindingsAllowed(parsed.data, surfaceValue.authorizedBindings))) throw new Error("surface_spec_invalid");
    const saved = confirmed(await services.repository.write({ kind: "surface_revision", id: input.revisionId as string, ownerUserId: context.userId!, memberUserIds: input.visibility === "personal_view" ? [] : surface.memberUserIds, value: { surfaceId: surface.id, baseRevisionId: input.baseRevisionId, spec: parsed.data, visibility: input.visibility, status: "preview" }, now: now(services) }));
    return { ...saved, previewUrl: new URL("/profile/design", services.linkBaseUrl).toString() };
  })),
  tool("decide_surface_revision", "Approve or reject surface revision", "Records this authorized member's explicit approval or rejection; shared publication remains governed.", z.object({ revisionId: idSchema, decision: z.enum(["approved", "rejected"]), confirmation: z.literal("confirmed"), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "decide_surface_revision", input, async () => {
    return confirmed(await services.repository.write({ kind: "surface_approval", id: `${input.revisionId}:${context.userId}`, ownerUserId: context.userId!, value: { revisionId: input.revisionId, decision: input.decision }, now: now(services) }));
  }), false, true),
  tool("rollback_surface", "Roll back surface", "Publishes a previously authorized revision using a base-version check.", z.object({ surfaceId: idSchema, revisionId: idSchema, expectedSurfaceVersion: z.number().int().positive(), confirmation: z.literal("confirmed"), ...mutate }).strict(), { ...writeAnnotations, destructiveHint: true }, async (input, context, services) => idempotent(context, services, "rollback_surface", input, async () => {
    const surface = await requiredRecord<Record<string, unknown>>(services, "surface", input.surfaceId as string, context.userId!);
    const revision = await requiredRecord<Record<string, unknown>>(services, "surface_revision", input.revisionId as string, context.userId!);
    if (revision.value.surfaceId !== surface.id) throw new Error("revision_surface_mismatch");
    if (revision.value.visibility === "personal_view") throw new Error("personal_view_not_rollback_target");
    const saved = await services.repository.write({ kind: "surface", id: surface.id, ownerUserId: surface.ownerUserId, actorUserId: context.userId!, memberUserIds: surface.memberUserIds, value: { ...surface.value, publishedRevisionId: revision.id }, expectedVersion: input.expectedSurfaceVersion as number, now: now(services) });
    const details = saved.value as Record<string, unknown>;
    return { confirmationState: "persisted", revisionId: details.rollbackRevisionId, publicationStatus: details.publicationStatus, proposalId: details.proposalId ?? null };
  }), false, true),

  tool("prepare_calendar_handoff", "Prepare Calendar handoff", "Returns authorized participant labels, time zones, shared candidate windows, and a room agenda. It does not create an event or call a Calendar provider.", z.object({ roomId: idSchema, ...workspaceInput }).strict(), readAnnotations, async (input, context, services) => {
    const room = await requiredRecord<Record<string, unknown>>(services, "room", input.roomId as string, context.userId!);
    if (room.value.status !== "active") throw new Error("room_not_available");
    return { roomId: room.id, participants: room.value.participants ?? [], timezones: room.value.timezones ?? [], candidateWindows: room.value.candidateWindows ?? [], agenda: room.value.agenda ?? "Continue the Buildmates introduction", options: ["codex_deep_link", "copy_prompt", "manual_times", "ics"] };
  }),
  tool("attach_calendar_event", "Attach Calendar event receipt", "After a Calendar provider confirms the room's accepted meeting, stores the provider ID, times, participant labels, and status only. It does not store Calendar credentials or event contents. This is a consequential write.", z.object({ receiptId: idSchema, roomId: idSchema, meetingProposalId: idSchema, provider: z.string().trim().min(1).max(80), providerEventId: z.string().trim().min(1).max(256), startsAt: isoDateSchema, endsAt: isoDateSchema, participantLabels: z.array(z.string().trim().min(1).max(120)).min(2).max(30), status: z.enum(["confirmed", "cancelled"]), providerConfirmed: z.literal(true), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "attach_calendar_event", input, async () => {
    const room = await requiredRecord(services, "room", input.roomId as string, context.userId!);
    if (Date.parse(input.endsAt as string) <= Date.parse(input.startsAt as string)) throw new Error("calendar_interval_invalid");
    const receipt = { roomId: room.id, meetingProposalId: input.meetingProposalId, provider: input.provider, providerEventId: input.providerEventId, startsAt: input.startsAt, endsAt: input.endsAt, participantLabels: input.participantLabels, status: input.status, trustedProviderConfirmation: true };
    return confirmed(await services.repository.write({ kind: "calendar_receipt", id: input.receiptId as string, ownerUserId: context.userId!, memberUserIds: room.memberUserIds, value: receipt, now: now(services) }));
  }), false, true),

  tool("get_automation_checkpoint", "Get Work Pulse progress", "Returns the saved progress, requested schedule, last outcome, and next run for the linked user's single Buildmates Work Pulse.", z.object(workspaceInput).strict(), readAnnotations, async (_input, context, services) => ({ checkpoint: value(await services.repository.readForMember("automation_checkpoint", `${context.userId}:buildmates`, context.userId!)) })),
  tool("update_automation_checkpoint", "Update Work Pulse progress", "Saves progress, requested schedule, source availability review, and last outcome for the linked user's single Work Pulse. Codex creates and schedules the recurring task.", z.object({ checkpointId: idSchema, cursor: z.string().max(500).nullable(), state: z.enum(["configured", "running", "succeeded", "needs_attention", "disabled"]), lastOutcome: z.string().trim().max(500), enabled: z.boolean().optional(), cadence: z.enum(["automatic", "manual", "daily", "twice_weekly", "weekly"]).nullable().optional(), sourceLivenessReviewed: z.boolean().optional(), nextRunAt: isoDateSchema.nullable(), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "update_automation_checkpoint", input, async () => confirmed(await services.repository.write({ kind: "automation_checkpoint", id: `${context.userId}:buildmates`, ownerUserId: context.userId!, value: { ...withoutRuntime(input), kind: "buildmates" }, now: now(services) })))),
  tool("probe_automation_capability", "Check background actions", "Checks whether this connected Buildmates app can save background results. A website request alone cannot mark this check as passed.", z.object({ probeId: idSchema, ...workspaceInput }).strict(), writeAnnotations, async (_input, context, services) => {
    if (!services.recordAutomationCapabilityProof) throw new Error("automation_probe_unavailable");
    return services.recordAutomationCapabilityProof({ userId: context.userId!, now: now(services) });
  }),
] as const;

export const BUILD_MATES_MCP_TOOLS = buildmatesToolRegistry.map((definition) => definition.name);

export function createBuildmatesMcpServer(services: BuildmatesToolServices): McpServer {
  const server = new McpServer({ name: "buildmates", version: "0.2.0" });
  for (const definition of buildmatesToolRegistry) {
    server.registerTool(definition.name, {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.input,
      annotations: definition.annotations,
      _meta: definition.consequential ? { "buildmates/consequential": true, "buildmates/confirmationRequired": true } : undefined,
    }, async (raw, extra) => {
      try {
        const subject = requireMcpSubject(extra.authInfo?.extra?.mcp_sub);
        const value = shouldExecuteRemoteTool(definition.name, services)
          ? await services.executeRemoteTool!({ name: definition.name, input: raw, mcpSubject: subject })
          : await executeBuildmatesTool(definition.name, raw, subject, services);
        return result(value);
      } catch (error) {
        return result({ error: safeError(error) }, true);
      }
    });
  }
  return server;
}

export function shouldExecuteRemoteTool(name: string, services: Pick<BuildmatesToolServices, "executeRemoteTool">): boolean {
  return Boolean(services.executeRemoteTool && name !== "get_link_url" && name !== "complete_identity_link");
}

export async function executeBuildmatesTool(name: string, raw: unknown, subject: unknown, services: BuildmatesToolServices): Promise<unknown> {
  const definition = buildmatesToolRegistry.find((candidate) => candidate.name === name);
  if (!definition) throw new Error("tool_not_found");
  const mcpSubject = requireMcpSubject(subject);
  const proposedScope = raw && typeof raw === "object" ? (raw as Record<string, unknown>).workspaceScope : undefined;
  if (proposedScope !== undefined && proposedScope !== "global") throw new Error("invalid_workspace_scope");
  const workspaceScope = "global";
  const linked = definition.preLink ? null : await services.resolveLinkedUser({ mcpSubject, workspaceScope });
  if (!definition.preLink && !linked) throw new Error("identity_link_required");
  const input = definition.input.parse(raw) as Record<string, unknown>;
  return definition.execute(input, { mcpSubject, userId: linked?.userId ?? null, workspaceScope }, services);
}

function tool(name: string, title: string, description: string, input: z.ZodType, annotations: ToolDefinition["annotations"], execute: ToolDefinition["execute"], preLink = false, consequential = false): ToolDefinition {
  return { name, title, description, input, annotations, execute, preLink, consequential };
}

function requireMcpSubject(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 256) throw new Error("oauth_required");
  return value;
}

async function idempotent<T>(context: ToolContext, services: BuildmatesToolServices, operation: string, input: unknown, execute: () => Promise<T>): Promise<{ replayed: boolean; result: T }> {
  const value = input as Record<string, unknown>;
  const key = String(value.idempotencyKey);
  const requestHash = await canonicalToolInputHash(input);
  const stored = await services.repository.runIdempotent({ actorUserId: context.userId!, operation, key, requestHash, now: now(services), execute });
  return { replayed: stored.replayed, result: stored.value };
}

async function requiredRecord<T = unknown>(services: BuildmatesToolServices, kind: string, id: string, actorUserId: string): Promise<McpRecord<T>> {
  const record = await services.repository.readForMember<T>(kind, id, actorUserId);
  if (!record) throw new Error("object_not_found_or_not_authorized");
  return record;
}

function withoutRuntime(input: Record<string, unknown>) {
  const value = { ...input };
  delete value.idempotencyKey;
  delete value.workspaceScope;
  return value;
}

function confirmed(record: McpRecord) {
  return { confirmationState: "persisted", id: record.id, version: record.version, details: record.value };
}

function value(record: McpRecord | null) {
  return record?.value ?? null;
}

function pageOptions(input: Record<string, unknown>, connectionId?: string) {
  return { cursor: typeof input.cursor === "string" ? input.cursor : undefined, limit: typeof input.limit === "number" ? input.limit : 20, filter: connectionId ? { connectionId } : undefined };
}

function surfaceBriefIsComplete(value: Record<string, unknown>, actor: string): boolean {
  if (!Array.isArray(value.allowedModules) || value.allowedModules.length === 0 || !Array.isArray(value.authorizedBindings) || value.authorizedBindings.length === 0 || !Array.isArray(value.trustedComponents) || value.trustedComponents.length === 0) return false;
  const governance = value.governance as Record<string, unknown> | undefined;
  if (!governance || !["profile", "room", "circle"].includes(String(value.kind))) return false;
  if (value.kind === "profile") return governance.mode === "owner" && governance.ownerUserId === actor && Array.isArray(governance.requiredApproverIds) && governance.requiredApproverIds.length > 0;
  if (governance.mode === "unanimous_members") return Array.isArray(governance.memberUserIds) && governance.memberUserIds.includes(actor) && Array.isArray(governance.requiredApproverIds) && governance.requiredApproverIds.length > 0 && governance.requiredApprovals === governance.requiredApproverIds.length;
  if (governance.mode === "circle_vote") return Array.isArray(governance.memberUserIds) && governance.memberUserIds.includes(actor) && Array.isArray(governance.eligibleVoterIds) && governance.eligibleVoterIds.length > 0 && governance.approvalRule === "strict_majority";
  if (governance.mode === "circle_admin") return Array.isArray(governance.memberUserIds) && governance.memberUserIds.includes(actor) && Array.isArray(governance.publisherUserIds) && governance.publisherUserIds.length > 0;
  return false;
}

function result(value: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError };
}

function now(services: BuildmatesToolServices): string {
  return (services.now?.() ?? new Date()).toISOString();
}

function linkedSetupProgress(progress: SetupProgress | undefined, services: BuildmatesToolServices): SetupProgress {
  return progress ?? { completedSteps: ["identity_link"], updatedAt: now(services) };
}

function surfaceBindingsAllowed(spec: SurfaceSpec, authorized: unknown): boolean {
  if (!Array.isArray(authorized) || authorized.some((value) => typeof value !== "string")) return false;
  const allowed = new Set(authorized as string[]);
  return spec.bindingManifest.content.every((binding) => allowed.has(binding.key))
    && spec.bindingManifest.media.every((binding) => allowed.has(binding.key) && allowed.has(binding.altKey));
}

async function verifySetupEvidence(payload: z.infer<typeof setupPayloadSchema>, userId: string, services: BuildmatesToolServices): Promise<void> {
  if (payload.step === "source_selection") for (const id of payload.sourceIds) await requiredRecord(services, "source_policy", id, userId);
  if (payload.step === "signal_privacy_review") for (const id of payload.reviewedSignalIds) await requiredRecord(services, "work_signal", id, userId);
  if (payload.step === "basic_profile") {
    const profile = await services.repository.readForMember<Record<string, unknown>>("profile_model", payload.profileId, userId);
    if (!profile || profile.value.handle !== payload.handle) throw new Error("setup_evidence_missing");
  }
  if (payload.step === "page_preview") {
    const revision = await requiredRecord<Record<string, unknown>>(services, "surface_revision", payload.surfaceRevisionId, userId);
    const surface = await requiredRecord<Record<string, unknown>>(services, "surface", String(revision.value.surfaceId), userId);
    const profile = (await services.repository.listForMember("profile_model", userId))[0];
    if (!profile || surface.value.kind !== "profile" || surface.value.subjectId !== profile.id || surface.value.publishedRevisionId !== revision.id) throw new Error("setup_evidence_missing");
  }
  if (payload.step === "networking_pulse") {
    const pulse = await requiredRecord<Record<string, unknown>>(services, "networking_pulse", payload.pulseId, userId);
    if (Date.parse(String(pulse.value.expiresAt)) <= Date.now()) throw new Error("setup_evidence_missing");
  }
  if (payload.step === "automation") {
    const checkpoints = await services.repository.listForMember<Record<string, unknown>>("automation_checkpoint", userId);
    if (!checkpoints.some((checkpoint) => checkpoint.value.state === "configured" || checkpoint.value.state === "succeeded")) throw new Error("setup_evidence_missing");
  }
  if (payload.step === "first_useful_outcome") {
    const kind = { candidate: "candidate_batch", follow: "follow_watch", watch: "follow_watch", invite: "invite" }[payload.kind];
    await requiredRecord(services, kind, payload.objectId, userId);
  }
}

function setupStateWithGuidance(state: ReturnType<typeof getSetupState>) {
  return {
    ...state,
    guidance: setupGuidance(state.nextStep),
    responseContract: "State what completed, what happens next, the exact user action, and the safe fallback. Never leave an incomplete setup response without a next action.",
  };
}

function setupGuidance(step: string | null) {
  if (step === "identity_link") return { goal: "Link this Codex identity to the signed-in Buildmates account.", nextAction: "Tell the user a browser will open for GitHub sign-in and Buildmates authorization, then get the link and wait up to five minutes for user completion. Do not launch a duplicate authorization while the first remains active.", fallback: "If the page expires, request one new link and clearly discard the old one." };
  if (step === "source_selection") return { goal: "Choose how Codex should understand the builder.", recommended: "codex_workspace", nextAction: "Present the exact workspace scope Codex proposes to review, then offer Use my Codex workspace, connected sources, direct answers, and Skip workspace review. Approval of the stated workspace scope covers immediate private context collection too: complete source_selection, review only that scope, maintain .buildmates/profile-context.md, and complete context_collection without a second permission prompt.", fallback: "If workspace review is skipped, continue with approved connected sources or focused questions and accept project or portfolio links." };
  if (step === "context_collection") return { goal: "Create a rich private profile draft.", nextAction: "If the user already approved the exact workspace scope during source selection, proceed without asking again. Maintain .buildmates/profile-context.md with projects, relationships between projects, current work, stack, interests, ambitions, meeting intent, confirmed style preferences, sources checked, and uncertainties. Show the synthesized draft for approval before submission. Ask again only if the research scope expands.", fallback: "If workspace review was skipped or context is sparse, use approved connected sources or ask focused profile questions." };
  if (step === "signal_privacy_review") return { goal: "Review recurring matching signals separately from the saved profile draft.", nextAction: "Say whether the profile draft is saved, then list recurring Work Signals. If there are none, explicitly say no ongoing source was connected." };
  if (step === "basic_profile") return { goal: "Review the complete structured profile and behavioral settings.", nextAction: "Explain profile visibility, matching, Manual versus Full Autopilot, map inclusion, and search-engine indexing before saving. Ask only about fields Codex could not infer confidently." };
  if (step === "page_preview") return { goal: "Generate and review a private custom profile page.", nextAction: "Use the returned starterSpec, validate it, submit a private preview, and provide the preview URL. If customization fails, submit the unchanged valid starterSpec rather than blocking setup." };
  return step ? { goal: `Complete ${step}.`, nextAction: "Explain the choice and complete only the returned setup step.", fallback: "Re-read setup state and report the exact next action." } : { goal: "Setup is complete.", nextAction: "Summarize the profile, networking settings, automation, and first useful action." };
}

function starterSurfaceSpec(kind: string): SurfaceSpec {
  const prefix = kind === "profile" ? "profile" : kind;
  const titleBinding = kind === "profile" ? "profile.displayName" : kind === "room" ? "room.themeTopic" : "circle.name";
  const summaryBinding = kind === "profile" ? "profile.summary" : kind === "room" ? "room.connectionContext" : "circle.purpose";
  return {
    schemaVersion: "1", designPolicyVersion: DESIGN_POLICY_VERSION, kind: kind as SurfaceSpec["kind"], title: "Buildmates page",
    theme: { mode: "light", colors: { canvas: "#f5f1e8", surface: "#fffdf8", ink: "#192019", mutedInk: "#4f5a50", accent: "#c9d7ad", accentInk: "#192019", rule: "#aeb7a8", focusInner: "#000000", focusOuter: "#ffffff" }, typography: { display: "editorial", body: "humanist", scale: "comfortable" }, shape: { corners: "soft", density: "comfortable" } },
    root: { id: `${prefix}-root`, type: "section", tone: "canvas", children: [{ id: `${prefix}-title`, type: "heading", level: 1, binding: titleBinding, fallback: kind === "profile" ? "Builder profile" : kind === "room" ? "Introduction room" : "Build Circle" }, { id: `${prefix}-summary`, type: "text", style: "lead", binding: summaryBinding, fallback: "This page is ready to personalize." }] },
    bindingManifest: { content: [{ key: titleBinding, type: "text" }, { key: summaryBinding, type: "text" }], media: [] }, approvedAssets: [], decorativeRegions: [], responsive: { collapseGridsBelow: "md", contentWidth: "standard", edgePadding: "comfortable" }, accessibility: { label: `${kind} page`, primaryHeadingNodeId: `${prefix}-title`, reducedMotion: "required" },
  };
}

function safeError(error: unknown): string {
  if (error instanceof z.ZodError) return "invalid_input";
  if (!(error instanceof Error)) return "tool_failed";
  return ["oauth_required", "identity_link_required", "invalid_workspace_scope", "object_not_found_or_not_authorized", "surface_brief_unavailable", "idempotency_conflict", "version_conflict", "surface_spec_invalid", "pulse_expiry_invalid", "calendar_interval_invalid", "revision_surface_mismatch", "source_actions_unsupported", "source_policy_denied", "source_approval_required", "taxonomy_identifiers_invalid", "setup_evidence_missing", "map_city_required", "invalid_invite_target", "invalid_follow_watch_target", "room_not_available"].includes(error.message) ? error.message : "tool_failed";
}
