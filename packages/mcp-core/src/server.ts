import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CANONICAL_CITIES, getSetupState, completeSetupStep, resolveCanonicalCity, type SetupProgress } from "@buildmates/domain";
import { DESIGN_POLICY_ID, DESIGN_POLICY_SOURCE_HASH, DESIGN_POLICY_VERSION, moduleAppearanceSchema, surfaceMediaIsAuthorized, safeParseSurfaceSpec, type ModuleAppearance, type SurfaceSpec } from "@buildmates/surfaces";
import { canonicalToolInputHash } from "./tool-hash";
import { z } from "zod";
import type { McpProductRepository, McpRecord } from "./repository";
import {
  idSchema, idempotencyKeySchema, isoDateSchema, networkingPulseSchema,
  profileModelSchema, setupPayloadSchema, sourcePolicySchema, summarySchema,
  workSignalSchema, workspaceScopeSchema,
} from "./schemas";
import type { CompleteIdentityLinkResult } from "./tools/identity";
import { customizedSurfaceExample, surfaceComponentReference } from "./surface-generation-reference";
import { targetedSurfaceRevisionIsAllowed } from "./surface-revision-intent";

const BUILD_GRAPH_TOPICS = [
  ["ai", "AI", null], ["developer-tools", "Developer tools", null], ["consumer-products", "Consumer products", null],
  ["social-community", "Social and community", null], ["productivity-workflows", "Productivity and workflows", null],
  ["design-creative", "Design and creative", null], ["marketplaces-commerce", "Marketplaces and commerce", null],
  ["data-infrastructure", "Data and infrastructure", null], ["robotics-hardware", "Robotics and hardware", null],
  ["chatgpt", "ChatGPT", "ai"], ["openai-platform", "OpenAI platform", "ai"], ["voice-ai", "Voice AI", "ai"],
  ["retrieval-augmented-generation", "Retrieval-augmented generation", "ai"], ["fine-tuning", "Fine-tuning", "ai"],
  ["ai-agents", "AI agents", "ai"], ["mcp", "Model Context Protocol", "ai"], ["ai-evals", "AI evaluations", "ai"],
  ["frontend", "Frontend engineering", "developer-tools"], ["backend", "Backend engineering", "developer-tools"],
  ["authentication", "Authentication", "developer-tools"], ["deployment", "Deployment", "developer-tools"],
  ["mobile-apps", "Mobile apps", "developer-tools"], ["databases", "Databases", "data-infrastructure"],
  ["analytics", "Analytics", "data-infrastructure"], ["cloud-infrastructure", "Cloud infrastructure", "data-infrastructure"],
  ["automation", "Automation", "productivity-workflows"], ["presentations", "Presentations", "productivity-workflows"],
  ["growth-marketing", "Growth and marketing", "social-community"], ["social-products", "Social products", "social-community"],
  ["communities", "Communities", "social-community"], ["privacy", "Privacy", "consumer-products"],
  ["creator-tools", "Creator tools", "design-creative"], ["marketplaces", "Marketplaces", "marketplaces-commerce"],
  ["payments", "Payments", "marketplaces-commerce"],
] as const;

const BUILD_GRAPH_RELATIONSHIPS = BUILD_GRAPH_TOPICS.flatMap(([id, , parentId]) => parentId ? [{ parentId, childId: id }] : []);

const NETWORKING_PULSE_OPTION_GUIDE = {
  intentSummary: "Who you want to meet and why during this temporary networking period.",
  builderSimilarity: {
    similar: "Prioritize builders doing closely related work.",
    adjacent: "Prioritize complementary builders whose work connects to yours without being the same.",
    balanced: "Mix closely related and complementary builders.",
  },
  geography: {
    local: "Prefer builders near the city or region you chose.",
    global: "Search globally without a local preference.",
    balanced: "Mix local and global possibilities.",
  },
  maximumIntroductionsPerWeek: "A hard weekly cap on new introductions, not a target Buildmates must fill.",
  quietHours: "Local-time windows when Buildmates should not schedule introduction activity.",
  serendipity: "How much variety to allow beyond the strongest obvious matches; 0 is strict and 100 is broad.",
  exclusions: "People, companies, industries, topics, or repeated clusters you do not want included.",
  expiresAt: "When this temporary intent must be reconfirmed so old preferences do not silently become permanent.",
} as const;

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
  createSurfaceAssetUploadGrant?(input: { userId: string; contentType: "image/jpeg" | "image/png"; now: string }): Promise<{ uploadUrl: string; expiresAt: string; maximumBytes: number; method: "POST" }>;
  attachProfileProjectMedia?(input: { userId: string; assetId: string; projectKey: string; projectTitle: string; altText: string; now: string }): Promise<{ assetId: string; src: string; altText: string; projectId: string; projectTitle: string }>;
  proposeRoomUpgrade?(input: { userId: string; roomId: string; proposalId: string; modules: Array<"resource_shelf" | "experiment_tracker" | "decision_log" | "feedback_queue" | "milestone_tracker">; explanation: string; title: string; appearance: ModuleAppearance; now: string }): Promise<{ proposalId: string; status: string }>;
  respondRoomUpgrade?(input: { userId: string; roomId: string; proposalId: string; response: "accepted" | "declined"; now: string }): Promise<{ proposalId: string; status: string }>;
  proposeCircleModule?(input: { userId: string; circleId: string; kind: "resource_shelf" | "experiment_tracker" | "decision_log" | "feedback_queue" | "milestone_tracker" | "scoreboard"; title: string; appearance: ModuleAppearance; now: string }): Promise<{ proposalId: string; status: string }>;
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
function safePublicDesignReference(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host !== "localhost" && host !== "0.0.0.0" && host !== "::1" && host !== "127.0.0.1" && !/^10\./.test(host) && !/^192\.168\./.test(host) && !/^172\.(?:1[6-9]|2\d|3[01])\./.test(host) && !/^169\.254\./.test(host);
  } catch { return false; }
}
const designReferenceSchema = z.object({
  url: z.string().url().refine(safePublicDesignReference, "Use a public HTTPS design reference without credentials or fragments"),
  title: z.string().trim().min(1).max(120),
  principles: z.array(z.string().trim().min(3).max(180)).min(2).max(6),
  designDna: z.object({
    macrostructure: z.string().trim().min(3).max(160),
    typography: z.string().trim().min(3).max(240),
    color: z.string().trim().min(3).max(240),
    rhythm: z.string().trim().min(3).max(240),
    interaction: z.string().trim().min(3).max(240),
  }).strict(),
}).strict();
const designCandidateSchema = z.object({
  url: z.string().url().refine(safePublicDesignReference, "Use a public HTTPS design reference without credentials or fragments"),
  title: z.string().trim().min(1).max(120),
  style: z.array(z.string().trim().min(2).max(40)).min(1).max(6),
  fit: z.string().trim().min(10).max(360),
  selected: z.boolean(),
}).strict();
const profileDesignBriefSchema = z.object({
  direction: z.string().trim().min(10).max(1000),
  sections: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  signatureElement: z.string().trim().min(3).max(300).optional(),
  selectionBasis: z.string().trim().min(20).max(600),
  designSystem: z.object({
    skill: z.string().trim().min(2).max(120),
    selection: z.enum(["user_preference", "hallmark_default", "buildmates_fallback"]),
    rationale: z.string().trim().min(12).max(360),
  }).strict(),
  contentPlan: z.object({
    narrative: z.string().trim().min(20).max(600),
    featuredProjectIds: z.array(z.string().trim().min(1).max(160)).max(20),
    omittedProjectIds: z.array(z.string().trim().min(1).max(160)).max(20),
    fillerFree: z.literal(true),
  }).strict(),
  candidates: z.array(designCandidateSchema).min(4).max(8),
  references: z.array(designReferenceSchema).min(1).max(2),
  qualityReview: z.object({
    viewports: z.array(z.object({ width: z.number().int().min(320).max(2560), height: z.number().int().min(568).max(2400), passed: z.literal(true) }).strict()).min(2).max(6),
    scores: z.object({ philosophy: z.number().int().min(3).max(5), hierarchy: z.number().int().min(3).max(5), execution: z.number().int().min(3).max(5), specificity: z.number().int().min(3).max(5), restraint: z.number().int().min(3).max(5), variety: z.number().int().min(3).max(5) }).strict(),
    checks: z.array(z.string().trim().min(3).max(120)).min(8).max(24),
    repairs: z.array(z.string().trim().min(3).max(240)).max(20),
    antiSlopAudit: z.object({
      passed: z.literal(true),
      signature: z.string().trim().min(12).max(300),
      findings: z.array(z.string().trim().min(3).max(180)).max(20),
    }).strict(),
    passed: z.literal(true),
  }).strict(),
}).strict().superRefine((brief, context) => {
  const candidateUrls = new Set(brief.candidates.map((candidate) => candidate.url));
  if (candidateUrls.size !== brief.candidates.length) context.addIssue({ code: "custom", message: "Reference candidates must be unique", path: ["candidates"] });
  const selectedUrls = new Set(brief.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.url));
  const referenceUrls = new Set(brief.references.map((reference) => reference.url));
  if (selectedUrls.size < 1 || selectedUrls.size > 2) context.addIssue({ code: "custom", message: "Select one or two researched candidates", path: ["candidates"] });
  if (selectedUrls.size !== referenceUrls.size || [...referenceUrls].some((url) => !selectedUrls.has(url))) context.addIssue({ code: "custom", message: "Selected candidates must match the chosen references", path: ["references"] });
  const viewportWidths = new Set(brief.qualityReview.viewports.map((viewport) => viewport.width));
  if (![...viewportWidths].some((width) => width >= 1200) || ![...viewportWidths].some((width) => width <= 414)) context.addIssue({ code: "custom", message: "Quality review must include a desktop and phone viewport", path: ["qualityReview", "viewports"] });
  const featured = new Set(brief.contentPlan.featuredProjectIds);
  if (brief.contentPlan.omittedProjectIds.some((id) => featured.has(id))) context.addIssue({ code: "custom", message: "A project cannot be both featured and omitted", path: ["contentPlan"] });
});
const surfaceRevisionIntentSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("full_redesign"), summary: z.string().trim().min(3).max(500) }).strict(),
  z.object({
    mode: z.literal("targeted"),
    summary: z.string().trim().min(3).max(500),
    targetNodeIds: z.array(idSchema).max(24),
    targetThemeKeys: z.array(z.enum(["colors", "typography", "shape", "atmosphere", "motion"])).max(5),
    targetDocumentFields: z.array(z.enum(["html", "css"])).max(2).optional(),
  }).strict().refine((value) => value.targetNodeIds.length > 0 || value.targetThemeKeys.length > 0 || (value.targetDocumentFields?.length ?? 0) > 0, "Name at least one node, theme area, or document field"),
]);

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
  tool("list_topic_taxonomy", "List Build Graph topics", "Returns canonical high-level and nested topic identifiers Codex may attach to an approved profile, project, or Work Signal. Prefer the most specific accurate topic; Buildmates automatically rolls descendants into parent totals and accounts for broader-only work. It contains no user data.", z.object(workspaceInput).strict(), readAnnotations, async () => ({ taxonomyVersion: "taxonomy-buildmates-v1", topics: BUILD_GRAPH_TOPICS.map(([id, label, parentId]) => ({ id, label, parentId })), relationships: BUILD_GRAPH_RELATIONSHIPS })),
  tool("submit_work_signal", "Submit permitted Work Signal", "Stores a concise summary used only for matching, along with approved topics and tools. Ask each time requires a one-time approval. Raw prompts, chats, documents, repository contents, email bodies, calendar contents, and credentials are not accepted.", z.object({ signal: workSignalSchema, ...workspaceInput }).strict(), writeAnnotations, async (input, context, services) => {
    const signal = input.signal as z.infer<typeof workSignalSchema>;
    const source = await services.repository.readForMember<Record<string, unknown>>("source_policy", signal.sourceId, context.userId!);
    const policy = source?.value.policy;
    if (!source || policy === "never" || policy === "actions_only") throw new Error("source_policy_denied");
    if (policy === "ask_each_time" && !signal.sourceApprovalId) throw new Error("source_approval_required");
    if (!(await services.validateTaxonomy({ taxonomyVersion: signal.taxonomyVersion, topicIds: signal.canonicalTopicIds, toolIds: signal.canonicalToolIds, domainIds: signal.canonicalDomainIds, stageIds: signal.canonicalStageIds, collaborationIntentIds: signal.canonicalCollaborationIntentIds }))) throw new Error("taxonomy_identifiers_invalid");
    return idempotent(context, services, "submit_work_signal", { ...signal, workspaceScope: context.workspaceScope }, async () => confirmed(await services.repository.write({ kind: "work_signal", id: signal.signalId, ownerUserId: context.userId!, value: signal, now: now(services) })));
  }),

  tool("get_networking_pulse", "Get Networking Pulse", "Returns the user's current temporary networking intent plus plain-language definitions for every control and option.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("networking_pulse", context.userId!, pageOptions(input)); return { pulses: page.records.map(value), optionGuide: NETWORKING_PULSE_OPTION_GUIDE, nextCursor: page.nextCursor }; }),
  tool("update_networking_pulse", "Update Networking Pulse", "Stores a temporary networking intent. Before saving, explain similar/adjacent/balanced matching, local/global/balanced geography, the weekly cap, quiet hours, serendipity, exclusions, and that expiry is a reconfirmation date.", z.object({ pulse: networkingPulseSchema, ...workspaceInput }).strict(), writeAnnotations, async (input, context, services) => {
    const pulse = input.pulse as z.infer<typeof networkingPulseSchema>;
    if (Date.parse(pulse.expiresAt) <= Date.parse(pulse.startsAt)) throw new Error("pulse_expiry_invalid");
    return idempotent(context, services, "update_networking_pulse", pulse, async () => confirmed(await services.repository.write({ kind: "networking_pulse", id: pulse.pulseId, ownerUserId: context.userId!, value: pulse, now: now(services) })));
  }),

  tool("get_profile_model", "Get profile model", "Returns the linked user's structured profile model and publication controls.", z.object(pageInput).strict(), readAnnotations, async (input, context, services) => { const page = await services.repository.listPageForMember("profile_model", context.userId!, pageOptions(input)); return { profiles: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("list_map_cities", "List supported Map cities", "Returns the city choices available for the anonymous aggregate Map. When a user deliberately adds a supported city, anonymous Map inclusion is on unless they choose to hide it. It contains no user data.", z.object(workspaceInput).strict(), readAnnotations, async () => ({ cities: CANONICAL_CITIES.map(({ id, label, country }) => ({ id, label, country })) })),
  tool("update_profile_model", "Save reviewed profile draft", "Stores a complete user-reviewed private profile draft, including confirmed interests, ambitions, meeting intent, private design preferences, and canonical topics for the anonymous Build Graph. Put idempotencyKey inside the profile object, not at the tool's top level. Canonical topic contributions never expose profile text or identity. The canonical profile page becomes public and search-engine indexable only after its generated page is explicitly approved and published.", z.object({ profile: profileModelSchema.describe("The complete reviewed private profile draft. The idempotencyKey belongs inside this profile object."), ...workspaceInput }).strict(), writeAnnotations, async (input, context, services) => {
    const profile = input.profile as z.infer<typeof profileModelSchema>;
    const city = resolveCanonicalCity(profile.coarseLocation);
    if (profile.canonicalTopicIds.length && (!profile.taxonomyVersion || !(await services.validateTaxonomy({ taxonomyVersion: profile.taxonomyVersion, topicIds: profile.canonicalTopicIds, toolIds: [], domainIds: [], stageIds: [], collaborationIntentIds: [] })))) throw new Error("taxonomy_identifiers_invalid");
    const normalizedProfile = { ...profile, coarseLocation: city?.label ?? profile.coarseLocation, locationMapOptIn: Boolean(city) && profile.locationMapOptIn !== false };
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

  tool("get_room_summaries", "Get room summaries", "Returns audience-filtered rooms plus privacy-safe activity, the linked user's own feedback state, and shared upgrade state. It never returns raw messages or another member's private feedback. Work Pulse may ask how a conversation went only when conversation.meaningful is true and feedback.submittedByViewer is false.", z.object({ roomId: idSchema.optional(), ...pageInput }).strict(), readAnnotations, async (input, context, services) => { if (input.roomId) return { rooms: [value(await requiredRecord(services, "room", input.roomId as string, context.userId!))], nextCursor: null }; const page = await services.repository.listPageForMember("room", context.userId!, pageOptions(input)); return { rooms: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("propose_room_upgrade", "Propose an optional room tool", "Creates a governed shared-tool proposal only after this user has submitted positive introduction feedback. Before proposing a custom appearance, use an approved user reference or create and show an ImageGen UI concept, obtain approval, then translate it through Hallmark into the bounded appearance fields. The proposer is recorded as interested, but no tool activates until every active room member accepts.", z.object({ proposalId: idSchema, roomId: idSchema, modules: z.array(z.enum(["resource_shelf", "experiment_tracker", "decision_log", "feedback_queue", "milestone_tracker"])).min(1).max(3), title: z.string().trim().min(1).max(120), appearance: moduleAppearanceSchema, explanation: z.string().trim().min(3).max(1000), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "propose_room_upgrade", input, async () => {
    if (!services.proposeRoomUpgrade) throw new Error("room_upgrade_unavailable");
    const result = await services.proposeRoomUpgrade({ userId: context.userId!, roomId: input.roomId as string, proposalId: input.proposalId as string, modules: input.modules as Array<"resource_shelf" | "experiment_tracker" | "decision_log" | "feedback_queue" | "milestone_tracker">, title: input.title as string, appearance: input.appearance as ModuleAppearance, explanation: input.explanation as string, now: now(services) });
    return { ...result, activated: false, approvalRequiredFromEveryActiveMember: true };
  })),
  tool("respond_room_upgrade", "Respond to a room tool proposal", "Accepts or declines an existing room shared-tool proposal for the linked user. Acceptance may activate the tool only when every active member has accepted; decline closes the proposal. Show the exact proposal and obtain explicit confirmation before calling.", z.object({ roomId: idSchema, proposalId: idSchema, response: z.enum(["accepted", "declined"]), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "respond_room_upgrade", input, async () => {
    if (!services.respondRoomUpgrade) throw new Error("room_upgrade_unavailable");
    return services.respondRoomUpgrade({ userId: context.userId!, roomId: input.roomId as string, proposalId: input.proposalId as string, response: input.response as "accepted" | "declined", now: now(services) });
  })),
  tool("get_circle_summaries", "Get Circle summaries", "Returns summaries for Circles where the linked user is an active member.", z.object({ circleId: idSchema.optional(), ...pageInput }).strict(), readAnnotations, async (input, context, services) => { if (input.circleId) return { circles: [value(await requiredRecord(services, "circle", input.circleId as string, context.userId!))], nextCursor: null }; const page = await services.repository.listPageForMember("circle", context.userId!, pageOptions(input)); return { circles: page.records.map(value), nextCursor: page.nextCursor }; }),
  tool("propose_circle_module", "Propose a Circle tool", "Creates a concrete governed Circle-tool proposal. First use a user-approved reference or an approved ImageGen UI concept, then use Hallmark to translate that direction into the bounded appearance schema. This records a proposal only; Circle admin or voting governance still controls activation.", z.object({ circleId: idSchema, kind: z.enum(["resource_shelf", "experiment_tracker", "decision_log", "feedback_queue", "milestone_tracker", "scoreboard"]), title: z.string().trim().min(1).max(120), appearance: moduleAppearanceSchema, ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "propose_circle_module", input, async () => {
    if (!services.proposeCircleModule) throw new Error("circle_module_unavailable");
    return services.proposeCircleModule({ userId: context.userId!, circleId: input.circleId as string, kind: input.kind as "resource_shelf" | "experiment_tracker" | "decision_log" | "feedback_queue" | "milestone_tracker" | "scoreboard", title: input.title as string, appearance: input.appearance as ModuleAppearance, now: now(services) });
  })),
  tool("submit_intro_feedback", "Submit introduction feedback", "Stores structured private feedback used to improve this user's future matching preferences. Call only after the linked user answers the feedback question; never infer an answer from message activity or save feedback merely because a room is eligible.", z.object({ feedbackId: idSchema, connectionId: idSchema, useful: z.boolean(), reasons: z.array(z.enum(["relevant_work", "shared_ambition", "good_conversation", "timing", "not_relevant", "other"])).min(1).max(6), preferenceSummary: z.string().trim().max(500).default(""), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "submit_intro_feedback", input, async () => {
    await requiredRecord(services, "connection", input.connectionId as string, context.userId!);
    return confirmed(await services.repository.write({ kind: "intro_feedback", id: input.feedbackId as string, ownerUserId: context.userId!, value: withoutRuntime(input), now: now(services) }));
  })),

  tool("get_surface_generation_brief", "Get surface generation brief", "Returns the current Design Policy, authorized bindings, governance, base revision, accessibility rules, and privacy boundary before generation.", z.object({ surfaceId: idSchema, ...workspaceInput }).strict(), readAnnotations, async (input, context, services) => {
    const surface = await services.repository.readForMember<Record<string, unknown>>("surface", input.surfaceId as string, context.userId!);
    if (!surface || !surfaceBriefIsComplete(surface.value, context.userId!, surface.ownerUserId)) {
      if (surface) console.warn("surface_brief_incomplete", surfaceBriefDiagnostics(surface.value, context.userId!, surface.ownerUserId));
      throw new Error("surface_brief_unavailable");
    }
    const starterSpec = starterSurfaceSpec(String(surface.value.kind));
    const trustedComponents = surface.value.trustedComponents as string[];
    const authorizedBindingTypes = surface.value.authorizedBindingTypes as Record<string, unknown> | null ?? null;
    const baseRevisionId = typeof surface.value.publishedRevisionId === "string" ? surface.value.publishedRevisionId : null;
    const baseRevision = baseRevisionId
      ? await services.repository.readForMember<Record<string, unknown>>("surface_revision", baseRevisionId, context.userId!)
      : null;
    return {
      surfaceId: surface.id, kind: surface.value.kind,
      designPolicy: { id: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION, sourceHash: DESIGN_POLICY_SOURCE_HASH, trustedComponents },
      allowedModules: surface.value.allowedModules, authorizedBindings: surface.value.authorizedBindings, authorizedBindingTypes,
      authorizedContent: surface.value.authorizedContent ?? null, requiredBindings: surface.value.requiredBindings ?? [],
      authorizedMedia: surface.value.authorizedMedia ?? [], approvedAssets: surface.value.approvedAssets ?? [], governance: surface.value.governance,
      baseRevision: baseRevisionId,
      currentRevision: baseRevision ? { id: baseRevision.id, version: baseRevision.version, spec: baseRevision.value.spec } : null,
      revisionWorkflow: {
        targeted: "For a small requested design change, start from currentRevision.spec, set revisionIntent.mode to targeted, name html and/or css in targetDocumentFields, preserve everything else, and keep every unrelated source field byte-for-byte.",
        fullRedesign: "Use full_redesign only when the user asks for a new direction or approves broad composition changes.",
      },
      starterSpec,
      generatedSiteReference: surfaceComponentReference(trustedComponents),
      customizedExample: customizedSurfaceExample({
        kind: surface.value.kind as "profile" | "room" | "circle",
        starterSpec,
        authorizedBindingTypes,
        authorizedContent: surface.value.authorizedContent as Record<string, unknown> | null | undefined,
        authorizedMedia: surface.value.authorizedMedia as Array<{ key: string; label: string; altKey: string; approvedAssetIds: string[] }> | undefined,
        approvedAssets: surface.value.approvedAssets as Array<{ id: string; src: string }> | undefined,
        trustedComponents,
      }),
      referenceResearch: surface.value.kind === "profile" ? {
        source: "https://recent.design/websites",
        privateMethod: "Privately inspect four to eight materially different Portfolio, Technology, SaaS, or otherwise relevant entries without sending profile text, names, project names, handles, or other user data to Recent Design. Open the selected creators' actual public sites when possible. Record every candidate, its style, its fit, and whether it was selected. Compare the set against the reviewed aesthetic, personality, amount and shape of approved content, and available media. Choose one or two entries for this person. Do not choose the first result, the previous user's choice, or a familiar reference by default. Honor a safe public HTTPS reference the user explicitly supplied when it fits.",
        categories: ["Portfolio", "Technology", "SaaS"],
        selectionRule: "Selected references need not be unique across all people, but the decision must be person-specific and auditable. Extract design DNA: macrostructure, type roles, color anchor, spatial rhythm, navigation, and motion. State why each chosen reference fits and why the others fit less well. Borrow principles without copying branding, copy, assets, exact layout, or a recognizable composition. Do not choose a direction whose quality depends on unavailable photography, 3D, illustration, or product media; either choose a media-independent reference or ask to create the small approved media set first.",
      } : null,
      designSkill: {
        precedence: ["explicit user-preferred local design skill", "approved visual reference or ImageGen concept", "Hallmark", "Buildmates internal design contract"],
        default: "Hallmark",
        rule: "Use an explicitly preferred local frontend or design skill when the user has named one. Establish art direction from a reference the user approved; when none exists, use ImageGen when available to create one polished full-page UI concept from approved facts, show it to the user, and obtain direction approval before implementation. Then use Hallmark as the default implementation discipline. If either tool is unavailable, use the strongest available design skill with this complete Buildmates quality contract. Do not stack multiple opinionated design systems. Design work stays in the user's Codex context; Buildmates receives only the reviewed brief, quality evidence, and generated HTML/CSS bundle.",
        hallmarkWorkflow: "Translate the approved reference or ImageGen concept into one coherent macrostructure, theme system, typography pairing, spacing rhythm, and at most three useful CSS-only motion primitives. For a shared surface, derive the visual world from approved relationship or Circle-purpose bindings rather than private messages. Author the complete semantic HTML fragment and responsive CSS directly; do not reduce the design to Buildmates components or embed the concept image as a screenshot of the page.",
        imageGenWorkflow: "Use case: ui-mockup. Create one complete desktop page concept, not a collage or fake browser frame. Use only approved content, omit invented metrics and capabilities, and optimize for a distinctive but implementable HTML/CSS visual system. Treat the output as art direction, show it before coding, and implement its principles responsively rather than publishing the raster mockup as the page.",
      },
      directionPreview: {
        requiredBeforeGeneration: true,
        wording: surface.value.kind === "profile" ? "Tell the user: I am leaning toward [direction] because [person-specific reason]. Name what the page will emphasize, its signature element, and what it will avoid. Invite a redirect, but do not force another question when the reviewed profile already supports a confident direction." : "Tell the members what visual direction fits the approved relationship or Circle purpose, what the shared page will emphasize, its signature element, and what it will avoid. Invite a redirect before generating the first private preview.",
      },
      mediaWorkflow: {
        approvedMediaAvailable: Array.isArray(surface.value.authorizedMedia) && surface.value.authorizedMedia.length > 0,
        whenMissing: "Media is optional. If the approved direction genuinely benefits from original imagery and ImageGen is available, propose only the small set the composition needs. Generate from approved facts, show every image before attachment, and require approval before upload and surface attachment.",
        attachAt: new URL(surface.value.kind === "profile" ? "/profile/design" : surface.value.kind === "room" ? `/rooms/${String(surface.value.subjectId)}` : `/circles/${String(surface.value.subjectId)}`, services.linkBaseUrl).toString(),
        safety: "Never invent product screens, logos, customers, metrics, results, or capabilities. Prefer real approved screenshots when available.",
      },
      visualQa: {
        requiredBeforeReady: true,
        viewports: [{ name: "desktop checkpoint", width: 1440, height: 1000 }, { name: "phone checkpoint", width: 390, height: 844 }],
        compareAgainst: surface.value.kind === "profile" ? "the approved person-specific direction, the chosen references' level of authorship, and the available approved media" : "the approved shared direction, the relationship or Circle purpose, and the available approved media",
        critiqueAxes: ["philosophy", "hierarchy", "execution", "specificity", "restraint", "variety"],
        minimumAxisScore: 3,
        inspect: ["distinctive full-page composition", "one coherent visual world", "one person-specific signature", "reference-quality hierarchy and pacing", "honest project treatment", "no repeated project content", "no generic filler", "no unmotivated decoration", "no known AI-design default stacks", "no excessive dead space", "no empty opening before the main identity unless approved visual media genuinely occupies it", "no vertical viewport units for continuous-page section heights", "fluid reflow at intermediate widths rather than a fixed checkpoint canvas", "alignment and gutters", "clipping and overflow", "readable column widths", "contrast and focus", "content visible without animation", "reduced-motion behavior"],
        onFailure: "A valid JSON document is not a visually approved page. Reject and revise a page with any critique score below three, repeated or filler content, unrelated decoration, incoherent visual worlds, excessive dead space, accidental clipping, weak mobile reflow, or material weakness against the selected references. Do not tell the user it is ready until both screenshots pass.",
      },
      constraints: {
        scripts: false, forms: false, arbitraryNetworkRequests: false, reducedMotion: "required", privacy: "server_resolved_bindings_only",
        media: surface.value.kind === "profile" ? "deliberately_public_project_assets_only" : "explicitly_attached_shared_surface_assets_only", contentCompleteness: "Every non-empty required binding must appear in the page; placeholder copy is rejected.",
        visualCompleteness: "The validator enforces isolation, approved content, and source validity. Codex owns the complete HTML/CSS art direction and must reject generic output during rendered visual QA. Projects are approved material, not a mandatory visual template.",
      },
      nextAction: surface.value.kind === "profile"
        ? "Use the user's explicitly preferred local design skill when named; otherwise use Hallmark, with the Buildmates design contract as fallback. Research four to eight materially different references and study the selected actual public sites for structural DNA without sending user data. Present one confident person-specific direction before generation. Author a complete semantic HTML fragment and responsive CSS using only the documented public bindings and approved asset paths. Do not compose Buildmates components or force a project template. Validate, render complete desktop and phone screenshots, and record the design-system selection, content plan, design DNA, critique scores, checks, and repairs. Reject generic, duplicated, incoherent, reference-disconnected, incomplete, or under-authored output before saying it is ready."
        : "Author a complete semantic HTML fragment and responsive CSS using only the shared bindings and explicitly attached assets in this brief. Keep chat, membership, approvals, scheduling, safety actions, and shared-tool behavior in trusted Buildmates controls outside the generated document. Validate, save a private preview, render desktop and phone checks, then collect the governance approvals returned in this brief before publication.",
    };
  }),
  tool("create_surface_asset_upload_grant", "Prepare generated image upload", "Creates a short-lived, one-time upload URL for one PNG or JPEG generated for a Buildmates surface. Uploading does not authorize the image for any profile, room, or Circle; attach it explicitly to the intended surface after upload. The URL stores only sanitized image data and expires after ten minutes.", z.object({ contentType: z.enum(["image/png", "image/jpeg"]), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "create_surface_asset_upload_grant", input, async () => {
    if (!services.createSurfaceAssetUploadGrant) throw new Error("surface_asset_upload_grant_unavailable");
    return services.createSurfaceAssetUploadGrant({ userId: context.userId!, contentType: input.contentType as "image/jpeg" | "image/png", now: now(services) });
  })),
  tool("attach_profile_project_media", "Attach approved profile image", "Associates an uploaded image owned by the linked user with one project already present in the reviewed public profile draft. This does not publish a page or make private content public.", z.object({ assetId: z.string().regex(/^asset_[a-z0-9_-]{8,80}$/i), projectKey: idSchema, projectTitle: z.string().trim().min(1).max(160), altText: z.string().trim().min(1).max(300), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "attach_profile_project_media", input, async () => {
    if (!services.attachProfileProjectMedia) throw new Error("profile_project_media_attachment_unavailable");
    return services.attachProfileProjectMedia({ userId: context.userId!, assetId: input.assetId as string, projectKey: input.projectKey as string, projectTitle: input.projectTitle as string, altText: input.altText as string, now: now(services) });
  })),
  tool("attach_surface_media", "Attach approved shared-surface image", "Authorizes one uploaded image owned by the linked user for one room or Circle surface where they are an active member. This does not publish a revision. Room unanimity or Circle governance still controls publication.", z.object({ attachmentId: idSchema, surfaceId: idSchema, assetId: z.string().regex(/^asset_[a-z0-9_-]{8,80}$/i), altText: z.string().trim().min(1).max(300), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "attach_surface_media", input, async () => {
    const surface = await requiredRecord<Record<string, unknown>>(services, "surface", input.surfaceId as string, context.userId!);
    if (!["room", "circle"].includes(String(surface.value.kind))) throw new Error("shared_surface_required");
    const bindingKey = `surface.media.${String(input.assetId).toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
    return confirmed(await services.repository.write({ kind: "surface_asset_attachment", id: input.attachmentId as string, ownerUserId: context.userId!, memberUserIds: surface.memberUserIds, value: { surfaceId: surface.id, assetId: input.assetId, bindingKey, altText: input.altText }, now: now(services) }));
  })),
  tool("validate_surface_spec", "Validate generated page", "Validates a GeneratedSiteBundle v3 for a profile, room, or Circle, while retaining legacy shared SurfaceSpec compatibility for stored pages. It returns exact field-level problems without saving. The example is syntax recovery, not art direction.", z.object({ surfaceId: idSchema, spec: z.unknown(), ...workspaceInput }).strict(), readAnnotations, async (input, context, services) => {
    const surface = await requiredRecord<Record<string, unknown>>(services, "surface", input.surfaceId as string, context.userId!);
    const parsed = safeParseSurfaceSpec(input.spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
    const kindMatches = parsed.success && parsed.data.kind === surface.value.kind;
    const bindingsAllowed = parsed.success && surfaceBindingsAllowed(parsed.data, surface.value.authorizedBindings) && surfaceMediaAllowed(parsed.data, surface.value);
    const qualityIssues = parsed.success && kindMatches && bindingsAllowed ? surfaceQualityIssues(parsed.data, surface.value) : [];
    if (parsed.success && kindMatches && bindingsAllowed && qualityIssues.length === 0) return { valid: true, issues: [] };
    const issues = parsed.success ? [!kindMatches ? { path: "kind", message: `Expected ${String(surface.value.kind)}` } : null, !bindingsAllowed ? { path: "bindingManifest", message: "A binding is not authorized for this page" } : null, ...qualityIssues].filter(Boolean) : parsed.error.issues.slice(0, 30).map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    return { valid: false, issues, recovery: "Restart from customizedExample, include every required binding, and replace placeholder or empty-shell content. Repair only the exact returned paths." };
  }),
  tool("submit_surface_revision", "Submit generated page revision", "Validates and stores a private generated-page revision. Profiles, rooms, and Circles may use complete semantic HTML and responsive CSS in GeneratedSiteBundle v3. Small changes target html and/or css while preserving unrelated source. Shared publication remains governed; generated documents cannot execute scripts or authorize data access.", z.object({ revisionId: idSchema, surfaceId: idSchema, baseRevisionId: idSchema.nullable(), spec: z.unknown().describe("Complete generated-page bundle previously checked with validate_surface_spec."), visibility: z.enum(["private_preview", "personal_view"]), revisionIntent: surfaceRevisionIntentSchema.optional(), designBrief: profileDesignBriefSchema.optional(), designBriefApproved: z.literal(true).optional(), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "submit_surface_revision", input, async () => {
    const surface = await requiredRecord(services, "surface", input.surfaceId as string, context.userId!);
    const parsed = safeParseSurfaceSpec(input.spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
    if (!parsed.success) throw new Error("surface_spec_invalid");
    const surfaceValue = surface.value as Record<string, unknown>;
    const revisionIntent = input.revisionIntent as z.infer<typeof surfaceRevisionIntentSchema> | undefined;
    if (parsed.data.kind !== surfaceValue.kind || (surfaceValue.authorizedBindingTypes && !surfaceBindingsAllowed(parsed.data, surfaceValue.authorizedBindings)) || !surfaceMediaAllowed(parsed.data, surfaceValue)) throw new Error("surface_spec_invalid");
    let targetedBaseApproved = false;
    if (revisionIntent?.mode === "targeted") {
      if (!input.baseRevisionId) throw new Error("targeted_revision_base_required");
      if (surfaceValue.kind === "profile" && surfaceValue.publishedRevisionId !== input.baseRevisionId) throw new Error("targeted_revision_base_not_published");
      const base = await requiredRecord<Record<string, unknown>>(services, "surface_revision", input.baseRevisionId as string, context.userId!);
      const baseParsed = safeParseSurfaceSpec(base.value.spec, DESIGN_POLICY_VERSION, { forRevisionCreation: true });
      if (!baseParsed.success || !targetedSurfaceRevisionIsAllowed(baseParsed.data, parsed.data, revisionIntent)) throw new Error("targeted_revision_scope_violation");
      targetedBaseApproved = true;
    }
    if (surfaceValue.kind === "profile") {
      if (parsed.data.schemaVersion !== "3") throw new Error("profile_generated_site_v3_required");
      if (input.designBriefApproved !== true || (!input.designBrief && !targetedBaseApproved)) throw new Error("profile_design_brief_required");
      if (JSON.stringify(parsed.data) === JSON.stringify(starterSurfaceSpec("profile"))) throw new Error("starter_spec_not_publishable");
    }
    const qualityIssues = surfaceQualityIssues(parsed.data, surfaceValue);
    if (qualityIssues.length > 0) throw new Error(`surface_spec_invalid:${JSON.stringify({ issues: qualityIssues })}`);
    const saved = confirmed(await services.repository.write({ kind: "surface_revision", id: input.revisionId as string, ownerUserId: context.userId!, memberUserIds: input.visibility === "personal_view" ? [] : surface.memberUserIds, value: { surfaceId: surface.id, baseRevisionId: input.baseRevisionId, spec: parsed.data, visibility: input.visibility, status: "preview", revisionIntent: revisionIntent ?? { mode: "full_redesign", summary: "New design direction" }, ...(input.designBrief ? { designBrief: input.designBrief } : {}) }, now: now(services) }));
    const previewPath = surfaceValue.kind === "profile" ? "/profile/design" : surfaceValue.kind === "room" ? `/rooms/${encodeURIComponent(String(surfaceValue.subjectId))}` : `/circles/${encodeURIComponent(String(surfaceValue.subjectId))}`;
    return { ...saved, previewUrl: new URL(previewPath, services.linkBaseUrl).toString() };
  })),
  tool("decide_surface_revision", "Approve or reject surface revision", "Records this authorized member's explicit approval or rejection; shared publication remains governed. When an approved profile revision publishes, the result includes its canonical /builders/{handle} public URL.", z.object({ revisionId: idSchema, decision: z.enum(["approved", "rejected"]), confirmation: z.literal("confirmed"), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "decide_surface_revision", input, async () => {
    const saved = confirmed(await services.repository.write({ kind: "surface_approval", id: `${input.revisionId}:${context.userId}`, ownerUserId: context.userId!, value: { revisionId: input.revisionId, decision: input.decision }, now: now(services) }));
    if (input.decision !== "approved") return saved;
    const publicUrl = await publishedProfileUrl(String(input.revisionId), context.userId!, services);
    return publicUrl ? { ...saved, publicUrl } : saved;
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
  tool("update_automation_checkpoint", "Update Work Pulse progress", "Saves the linked user's single Buildmates Work Pulse and completes the final setup step when a reviewed schedule is configured. Recommend Tuesdays and Fridays when recurring automations are available. Manual refresh is only an explicit user override or an automation-unavailable fallback.", z.object({ checkpointId: idSchema, cursor: z.string().max(500).nullable(), state: z.enum(["configured", "running", "succeeded", "needs_attention", "disabled"]), lastOutcome: z.string().trim().max(500), enabled: z.boolean().optional(), cadence: z.enum(["automatic", "manual", "daily", "twice_weekly", "weekly"]).nullable().optional(), sourceLivenessReviewed: z.boolean().optional(), nextRunAt: isoDateSchema.nullable(), ...mutate }).strict(), writeAnnotations, async (input, context, services) => idempotent(context, services, "update_automation_checkpoint", input, async () => {
    const saved = confirmed(await services.repository.write({ kind: "automation_checkpoint", id: `${context.userId}:buildmates`, ownerUserId: context.userId!, value: { ...withoutRuntime(input), kind: "buildmates" }, now: now(services) }));
    const setup = await completeAutomationSetupIfReady(input, context.userId!, services);
    return { ...saved, setup };
  })),
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

function surfaceBriefIsComplete(value: Record<string, unknown>, actor: string, recordOwnerUserId = actor): boolean {
  if (!Array.isArray(value.allowedModules) || value.allowedModules.length === 0 || !Array.isArray(value.authorizedBindings) || value.authorizedBindings.length === 0 || !Array.isArray(value.trustedComponents) || value.trustedComponents.length === 0) return false;
  const governance = value.governance as Record<string, unknown> | undefined;
  if (!governance || !["profile", "room", "circle"].includes(String(value.kind))) return false;
  if (value.kind === "profile") return governance.mode === "owner" && recordOwnerUserId === actor && Array.isArray(governance.requiredApproverIds) && governance.requiredApproverIds.includes(actor);
  if (governance.mode === "unanimous_members") return Array.isArray(governance.memberUserIds) && governance.memberUserIds.includes(actor) && Array.isArray(governance.requiredApproverIds) && governance.requiredApproverIds.length > 0 && governance.requiredApprovals === governance.requiredApproverIds.length;
  if (governance.mode === "circle_vote") return Array.isArray(governance.memberUserIds) && governance.memberUserIds.includes(actor) && Array.isArray(governance.eligibleVoterIds) && governance.eligibleVoterIds.length > 0 && governance.approvalRule === "strict_majority";
  if (governance.mode === "circle_admin") return Array.isArray(governance.memberUserIds) && governance.memberUserIds.includes(actor) && Array.isArray(governance.publisherUserIds) && governance.publisherUserIds.length > 0;
  return false;
}

function surfaceBriefDiagnostics(value: Record<string, unknown>, actor: string, recordOwnerUserId: string) {
  const governance = value.governance as Record<string, unknown> | undefined;
  return {
    kind: typeof value.kind === "string" ? value.kind : "missing",
    hasAllowedModules: Array.isArray(value.allowedModules) && value.allowedModules.length > 0,
    hasAuthorizedBindings: Array.isArray(value.authorizedBindings) && value.authorizedBindings.length > 0,
    hasTrustedComponents: Array.isArray(value.trustedComponents) && value.trustedComponents.length > 0,
    hasGovernance: Boolean(governance),
    ownerRecordMatchesActor: recordOwnerUserId === actor,
    ownerApproverIncludesActor: Array.isArray(governance?.requiredApproverIds) && governance.requiredApproverIds.includes(actor),
  };
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

type SurfaceIssue = { path: string; message: string };
function surfaceQualityIssues(spec: SurfaceSpec, surface: Record<string, unknown>): SurfaceIssue[] {
  const issues: SurfaceIssue[] = [];
  const manifestBindings = new Set(spec.bindingManifest.content.map((binding) => binding.key));
  const requiredBindings = Array.isArray(surface.requiredBindings) ? surface.requiredBindings.filter((binding): binding is string => typeof binding === "string") : [];
  for (const binding of requiredBindings) if (!manifestBindings.has(binding)) issues.push({ path: "bindingManifest.content", message: `Include approved profile content binding ${binding}` });
  if (spec.schemaVersion === "3") {
    const source = spec.document.html;
    for (const binding of requiredBindings) {
      const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}|data-buildmates-repeat=[\"']${escaped}[\"']`, "i").test(source)) issues.push({ path: "document.html", message: `Render approved ${spec.kind} content binding ${binding}` });
    }
    if (/\b(?:will appear|coming soon|ready to personali[sz]e|lorem ipsum|placeholder|add your)\b/i.test(source)) issues.push({ path: "document.html", message: "Replace placeholder copy with approved content or remove it" });
    return issues.slice(0, 30);
  }
  if (spec.kind !== "profile") return issues.slice(0, 30);
  const nodes = collectSurfaceNodes(spec.root as unknown as Record<string, unknown>);
  if (requiredBindings.includes("profile.projects") && !nodes.some((node) => (node.type === "project-list" || node.type === "featured-project" || node.type === "project-artifact") && node.binding === "profile.projects")) issues.push({ path: "root", message: "Approved projects require a visible project list, feature, or governed project artifact" });
  if (requiredBindings.includes("profile.facts") && !nodes.some((node) => node.type === "fact-list" && node.binding === "profile.facts")) issues.push({ path: "root", message: "Approved interests, ambitions, or current-work facts require a visible fact-list" });
  const placeholder = /\b(?:will appear|coming soon|ready to personali[sz]e|details? (?:will )?appear|projects? (?:will )?appear|lorem ipsum|placeholder|add (?:your|a) )\b/i;
  for (const node of nodes) for (const property of ["fallback", "emptyMessage"] as const) if (typeof node[property] === "string" && placeholder.test(node[property] as string)) issues.push({ path: `root.${String(node.id ?? "node")}.${property}`, message: "Replace placeholder copy with an honest empty state or approved content" });
  return issues.slice(0, 30);
}

function collectSurfaceNodes(root: Record<string, unknown>): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const pending: Record<string, unknown>[] = [root];
  while (pending.length) {
    const node = pending.pop();
    if (!node) continue;
    nodes.push(node);
    if (Array.isArray(node.children)) for (const child of node.children) if (child && typeof child === "object") pending.push(child as Record<string, unknown>);
  }
  return nodes;
}

function surfaceMediaAllowed(spec: SurfaceSpec, surface: Record<string, unknown>): boolean {
  return surfaceMediaIsAuthorized(
    spec,
    Array.isArray(surface.authorizedMedia) ? surface.authorizedMedia as Array<{ key: string; label: string; altKey: string; approvedAssetIds: string[] }> : [],
    Array.isArray(surface.approvedAssets) ? surface.approvedAssets as Array<{ id: string; src: string }> : [],
  );
}

async function publishedProfileUrl(revisionId: string, userId: string, services: BuildmatesToolServices): Promise<string | null> {
  const revision = await services.repository.readForMember<Record<string, unknown>>("surface_revision", revisionId, userId);
  if (!revision) return null;
  const surface = await services.repository.readForMember<Record<string, unknown>>("surface", String(revision.value.surfaceId), userId);
  if (!surface || surface.value.kind !== "profile" || surface.value.publishedRevisionId !== revisionId) return null;
  const profile = (await services.repository.listForMember<Record<string, unknown>>("profile_model", userId))
    .find((candidate) => candidate.id === surface.value.subjectId);
  const handle = profile?.value.handle;
  return typeof handle === "string" && handle.length > 0
    ? new URL(`/builders/${encodeURIComponent(handle)}`, services.linkBaseUrl).toString()
    : null;
}

async function completeAutomationSetupIfReady(
  input: Record<string, unknown>,
  userId: string,
  services: BuildmatesToolServices,
): Promise<ReturnType<typeof getSetupState> | null> {
  const current = await services.repository.readForMember<SetupProgress>("setup", userId, userId);
  const progress = getSetupState(linkedSetupProgress(current?.value, services));
  if (progress.complete) return progress;
  const canComplete = progress.nextStep === "automation"
    && (input.state === "configured" || input.state === "succeeded")
    && input.sourceLivenessReviewed === true
    && typeof input.cadence === "string";
  if (!canComplete) return null;
  const completed = completeSetupStep(progress, "automation", now(services));
  await services.repository.write({ kind: "setup", id: userId, ownerUserId: userId, value: completed, now: now(services) });
  return completed;
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
  if (step === "source_selection") return { goal: "Choose how Codex should understand the builder.", recommended: "codex_workspace", requiredHostResultLimit: 50, workspaceOnlySourceIds: [], requiredHostDiscovery: "Before presenting the scope, call list_threads with limit 50, the largest accepted result window on the current Codex host, and inventory every returned task without filtering to the current directory. Do not rely on the smaller default. If another host rejects 50, retry once with its largest accepted limit and disclose the bounded inventory. Group tasks by normalized project root, retain unscoped tasks, and combine the inventory with GBrain and memory indexes. Explicitly name every product-bearing root and every GBrain-indexed product; never collapse product roots into an other bucket or unnamed remainder. Render one line per product with its exact absolute normalized root or roots and task counts; phrases such as project root plus worktree are not substitutes for paths. Product counts plus the non-product utility count must equal the total returned task count. Non-product utility tasks may be summarized only with their total count and explicit exclusion from profile research. Do not read task bodies before consent.", nextAction: "Name every discovered product, exact root, task count, and proposed GBrain or memory file. Then offer Use my Codex workspace, connected sources, direct answers, and Skip workspace review. For a workspace-only choice, complete source_selection with sourceIds: []; codex_workspace is not a connected-source ID. Approval of the stated workspace scope covers immediate private context collection too: review only that scope, maintain .buildmates/profile-context.md, and complete context_collection without a second permission prompt.", completionGate: "A current-directory-only, default-window, unnamed-product, path-omitting, or unreconciled proposal is not a Codex workspace review when broader task discovery is available. If discovery is unavailable, label the option current-project review and say why.", fallback: "If workspace review is skipped, continue with approved connected sources or focused questions and accept project or portfolio links." };
  if (step === "context_collection") return { goal: "Create a rich private profile draft.", requiredCoverage: "Account for every task in every project in the approved inventory. Read enough of each task to capture purpose, current state, decisions, stack, and relationships, following pagination when available. Record every task as reviewed or explicitly skipped with a reason.", nextAction: "If the user already approved the exact workspace scope during source selection, proceed without asking again. Maintain .buildmates/profile-context.md progressively with the task inventory, projects, relationships between projects, current work, stack, interests, ambitions, meeting intent, confirmed style preferences, sources checked, and uncertainties. Show the synthesized draft for approval before submission. Ask again only if the research scope expands.", completionGate: "Do not complete context_collection when multiple projects were discovered but only the current project is represented.", fallback: "If workspace review was skipped or context is sparse after the approved inventory is complete, use approved connected sources or ask focused profile questions." };
  if (step === "signal_privacy_review") return { goal: "Review recurring matching signals separately from the saved profile draft.", nextAction: "Say whether the profile draft is saved, then list recurring Work Signals. If there are none, explicitly say no ongoing source was connected." };
  if (step === "basic_profile") return { goal: "Review the complete structured profile and behavioral settings.", nextAction: "Present the proposed profile and explain each setting in plain language before asking for one approval. The profile remains a private draft until the user approves and publishes its generated page; a published profile is public, shareable, and search-engine indexable. Matching enabled lets Buildmates use only approved matching fields to suggest relevant builders and remains independent from publication; it does not expose raw workspace sources. If the user supplies a city, Codex may include it naturally in the approved profile. The city also contributes by default to an anonymous aggregate Map bubble, never a personal pin; Buildmates receives no precise or live location, and the user may disable the aggregate contribution in privacy settings. Call list_topic_taxonomy, classify the reviewed profile and projects using only returned IDs, and include those canonicalTopicIds so they join the anonymous Build Graph; never submit raw workspace text to the graph. Private style and personality notes guide Codex's design but are not displayed. Explain Manual versus Full Autopilot and whether recurring Work Signals exist. Ask only about fields Codex could not infer confidently." };
  if (step === "page_preview") return { goal: "Generate and review a private custom profile page.", nextAction: "Use an explicitly preferred local design skill when the user named one; otherwise use Hallmark when available, with the Buildmates design contract as fallback. Do not stack opinionated design systems by default. Privately compare four to eight materially different safe public references from Recent Design or user-supplied inspiration without sending user data. Study one or two selected actual sites for macrostructure, type roles, color, rhythm, navigation, and motion; never copy branding, copy, assets, or recognizable composition. First tell the user which direction you are leaning toward, why it fits them, what it will emphasize, its signature element, and what it will avoid. Invite a redirect without forcing another question when the direction is confident. Author a complete semantic HTML body fragment and responsive CSS as GeneratedSiteBundle v3. Do not compose Buildmates components or force a project template. Use every required public binding and only exact approved asset paths. customizedExample is syntax recovery, not a layout. Validate and repair exact paths. Submit only a private preview after rendered desktop and phone checks pass. Score philosophy, hierarchy, execution, specificity, restraint, and variety from one to five; any score below three fails. Also reject duplicated content, unrelated decoration, incoherent visual worlds, excessive dead space, accidental clipping, poor mobile reflow, or material weakness against the chosen references. Never publish or call the recovery seed Design 1. Present the result as a first direction and explicitly invite conversational changes or a complete rethink." };
  if (step === "networking_pulse") return { goal: "Set a temporary Networking Pulse for who the user wants to meet.", recommended: { builderSimilarity: "balanced", geography: "global", maximumIntroductionsPerWeek: 3, expiresInDays: 30 }, nextAction: "Explain every proposed value before asking once for confirmation. Intent is who they want to meet and why. Similar prioritizes closely related work, adjacent prioritizes complementary work, and balanced mixes both. Geography can prioritize local builders, search globally, or mix both. The weekly maximum is a hard cap, quiet hours prevent introduction activity during local-time windows, serendipity controls variety beyond obvious matches, exclusions remove unwanted people or clusters, and expiry is when this temporary intent must be reconfirmed so it does not silently become permanent.", fallback: "If the user is unsure, keep the balanced, global, three-per-week, 30-day defaults and invite them to change any one setting." };
  if (step === "acceptance_mode") return { goal: "Choose how introductions are accepted.", nextAction: "Explain that Manual requires the user's Interested action after Codex independently approves a candidate. Full Autopilot still requires independent approval on both sides and works only when the connected host proves unattended actions are available." };
  if (step === "automation") return { goal: "Configure the notification and intelligence surface that keeps Buildmates current.", recommended: "A single Buildmates Work Pulse every Tuesday and Friday in the user's timezone.", nextAction: "When recurring automations are available, recommend Tuesdays and Fridays and ask once before creating or materially changing the schedule. Explain that each run reviews only permitted sources, refreshes approved profile and project topics plus changed or expiring Work Signals, checks one bounded candidate shortlist and the saved relevance watch, independently evaluates candidates, and posts sources checked, changes, matches, actions needed, and the next run to the Codex task. It also checks privacy-safe room activity: after a meaningful two-way conversation it asks how the introduction went, saves feedback only after the user answers, and after this user's positive feedback may suggest one contextual optional room module with a reason. A suggestion never activates a module; both room members must approve the proposal. An unchanged run must say that nothing changed and must not invent or relabel old activity as new. Create or update exactly one automation, then call update_automation_checkpoint once with cadence twice_weekly and sourceLivenessReviewed true; that write completes setup without a separate automation setup-step call.", fallback: "Use manual refresh only when the user explicitly chooses it or recurring automations are unavailable, and state which condition applies." };
  return step ? { goal: `Complete ${step}.`, nextAction: "Explain the choice and complete only the returned setup step.", fallback: "Re-read setup state and report the exact next action." } : { goal: "Setup is complete.", nextAction: "Summarize the profile, Networking Pulse, acceptance mode, and Work Pulse schedule. Give the canonical /builders/{handle} profile link, explain that profile updates and redesigns can be requested directly in Codex with the Buildmates plugin, and offer an optional personal invite link. Explain that Buildmates improves as more builders join and accepted invite joins are attributed to the inviter; an invite is not a setup requirement." };
}

function starterSurfaceSpec(kind: string): SurfaceSpec {
  if (kind === "profile") {
    return {
      schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "Buildmates generated profile recovery seed",
      document: {
        html: '<main class="profile"><h1>{{profile.displayName}}</h1><p>{{profile.summary}}</p><section><template data-buildmates-repeat="profile.projects"><article><h2>{{item.title}}</h2><p>{{item.summary}}</p></article></template></section><dl><template data-buildmates-repeat="profile.facts"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></main>',
        css: ':root{color-scheme:light}.profile{max-width:72rem;margin:auto;padding:clamp(1rem,5vw,5rem);font-family:system-ui,sans-serif;color:#171914;background:#f7f4ec}.profile h1{font-size:clamp(3rem,9vw,8rem);line-height:.9}.profile article{border-top:1px solid #555;padding:1.5rem 0}@media(max-width:600px){.profile{padding:1rem}.profile h1{font-size:clamp(2.5rem,16vw,5rem)}}@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}',
      },
      bindingManifest: { content: [{ key: "profile.displayName", type: "text" }, { key: "profile.summary", type: "text" }, { key: "profile.projects", type: "projects" }, { key: "profile.facts", type: "facts" }], media: [] },
      approvedAssets: [], responsive: { desktopMinHeight: 1100, phoneMinHeight: 1400 }, accessibility: { label: "Builder profile", reducedMotion: "required" },
    };
  }
  if (kind === "room") return {
    schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "room", title: "Buildmates generated room recovery seed",
    document: { html: '<main class="shared"><p>{{room.whyTitle}}</p><h1>{{room.title}}</h1><p>{{room.whyBody}}</p><dl><template data-buildmates-repeat="room.sharedFacts"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl><small>{{room.privacyNote}}</small></main>', css: ':root{color-scheme:light}.shared{max-width:72rem;margin:auto;padding:clamp(1rem,5vw,4rem);font-family:system-ui,sans-serif;color:#171914;background:#f7f4ec}.shared h1{font-size:clamp(2.5rem,8vw,7rem);line-height:.95}@media(max-width:600px){.shared{padding:1rem}}@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}' },
    bindingManifest: { content: [{ key: "room.title", type: "text" }, { key: "room.whyTitle", type: "text" }, { key: "room.whyBody", type: "text" }, { key: "room.sharedFacts", type: "facts" }, { key: "room.privacyNote", type: "text" }], media: [] }, approvedAssets: [], responsive: { desktopMinHeight: 800, phoneMinHeight: 900 }, accessibility: { label: "Introduction room", reducedMotion: "required" },
  };
  return {
    schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "circle", title: "Buildmates generated Circle recovery seed",
    document: { html: '<main class="shared"><h1>{{circle.name}}</h1><p>{{circle.purpose}}</p><section><h2>Members</h2><dl><template data-buildmates-repeat="circle.members"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></section><section><h2>Shared tools</h2><dl><template data-buildmates-repeat="circle.modules"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></section><dl><template data-buildmates-repeat="circle.metrics"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></main>', css: ':root{color-scheme:light}.shared{max-width:72rem;margin:auto;padding:clamp(1rem,5vw,4rem);font-family:system-ui,sans-serif;color:#171914;background:#f7f4ec}.shared h1{font-size:clamp(2.5rem,8vw,7rem);line-height:.95}@media(max-width:600px){.shared{padding:1rem}}@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}' },
    bindingManifest: { content: [{ key: "circle.name", type: "text" }, { key: "circle.purpose", type: "text" }, { key: "circle.members", type: "facts" }, { key: "circle.modules", type: "facts" }, { key: "circle.metrics", type: "facts" }], media: [] }, approvedAssets: [], responsive: { desktopMinHeight: 900, phoneMinHeight: 1100 }, accessibility: { label: "Build Circle", reducedMotion: "required" },
  };
}

function safeError(error: unknown): string {
  if (error instanceof z.ZodError) return "invalid_input";
  if (!(error instanceof Error)) return "tool_failed";
  if (error.message.startsWith("surface_spec_invalid:")) return error.message;
  return ["oauth_required", "identity_link_required", "invalid_workspace_scope", "object_not_found_or_not_authorized", "surface_brief_unavailable", "idempotency_conflict", "version_conflict", "surface_spec_invalid", "profile_generated_site_v3_required", "profile_design_brief_required", "starter_spec_not_publishable", "pulse_expiry_invalid", "calendar_interval_invalid", "revision_surface_mismatch", "source_actions_unsupported", "source_policy_denied", "source_approval_required", "taxonomy_identifiers_invalid", "setup_evidence_missing", "map_city_required", "invalid_invite_target", "invalid_follow_watch_target", "room_not_available"].includes(error.message) ? error.message : "tool_failed";
}
