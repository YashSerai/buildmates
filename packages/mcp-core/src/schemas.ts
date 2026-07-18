import { z } from "zod";
import { SETUP_STEPS } from "@buildmates/domain";

export const workspaceScopeSchema = z.literal("global").default("global");
export const idSchema = z.string().trim().min(3).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/);
export const idempotencyKeySchema = z.string().trim().min(8).max(128);
export const isoDateSchema = z.string().datetime({ offset: true });
export const summarySchema = z.string().trim().min(1).max(1200);
export const profileContextSummarySchema = z.string().trim().min(1).max(12_000);
export const audienceSchema = z.enum(["public", "signed_in", "suggested_connections", "mutual_connections", "private"]);
export const workSignalAudienceSchema = z.enum(["suggested_connections", "mutual_connections", "private"]);
export const sourcePolicySchema = z.enum(["never", "ask_each_time", "allow_approved_work_signals", "actions_only"]);

export const setupPayloadSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("identity_link") }).strict(),
  z.object({ step: z.literal("storage_explanation"), acknowledged: z.literal(true) }).strict(),
  z.object({ step: z.literal("source_selection"), sourceIds: z.array(idSchema).max(50) }).strict(),
  z.object({ step: z.literal("context_collection"), method: z.enum(["codex_workspace", "connected_context", "manual_profile", "repository", "project", "pasted_description", "portfolio_links"]), summary: profileContextSummarySchema, links: z.array(z.string().url().max(500)).max(30).default([]) }).strict(),
  z.object({ step: z.literal("signal_privacy_review"), reviewedSignalIds: z.array(idSchema).max(100), acknowledged: z.literal(true) }).strict(),
  z.object({ step: z.literal("basic_profile"), profileId: idSchema, handle: z.string().trim().min(3).max(32).regex(/^[a-z0-9_]+$/), approved: z.literal(true) }).strict(),
  z.object({ step: z.literal("page_preview"), surfaceRevisionId: idSchema, approved: z.literal(true) }).strict(),
  z.object({ step: z.literal("networking_pulse"), pulseId: idSchema }).strict(),
  z.object({ step: z.literal("acceptance_mode"), mode: z.enum(["manual", "full_autopilot"]) }).strict(),
  z.object({ step: z.literal("automation"), enabled: z.boolean(), cadence: z.enum(["automatic", "manual", "daily", "twice_weekly", "weekly"]), sourceLivenessReviewed: z.boolean() }).strict(),
  z.object({ step: z.literal("first_useful_outcome"), kind: z.enum(["candidate", "follow", "watch", "invite"]), objectId: idSchema }).strict(),
]);

export const setupStepSchema = z.enum(SETUP_STEPS);

export const workSignalSchema = z.object({
  signalId: idSchema,
  sourceId: idSchema,
  taxonomyVersion: z.string().trim().min(1).max(40),
  summary: summarySchema,
  canonicalTopicIds: z.array(idSchema).max(30).default([]),
  canonicalToolIds: z.array(idSchema).max(30).default([]),
  canonicalDomainIds: z.array(idSchema).max(30).default([]),
  canonicalStageIds: z.array(idSchema).max(10).default([]),
  canonicalCollaborationIntentIds: z.array(idSchema).max(20).default([]),
  audience: workSignalAudienceSchema,
  allowMatching: z.boolean(),
  expiresAt: isoDateSchema,
  approved: z.literal(true),
  sourceApprovalId: idSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const networkingPulseSchema = z.object({
  pulseId: idSchema,
  intentSummary: summarySchema,
  builderSimilarity: z.enum(["similar", "adjacent", "balanced"]),
  geography: z.enum(["local", "global", "balanced"]),
  maximumIntroductionsPerWeek: z.number().int().min(0).max(20),
  serendipity: z.number().int().min(0).max(100),
  timezone: z.string().trim().min(1).max(80),
  quietHours: z.array(z.object({ weekday: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(0).max(1439) }).strict()).max(14).default([]),
  snoozedUntil: isoDateSchema.nullable().default(null),
  exclusions: z.array(z.object({ kind: z.enum(["user", "company", "industry", "topic", "cluster"]), value: z.string().trim().min(1).max(120) }).strict()).max(100).default([]),
  startsAt: isoDateSchema,
  expiresAt: isoDateSchema,
  idempotencyKey: idempotencyKeySchema,
}).strict();

export const profileModelSchema = z.object({
  profileId: idSchema,
  handle: z.string().trim().min(3).max(32).regex(/^[a-z0-9_]+$/),
  displayName: z.string().trim().min(1).max(80),
  builderSummary: z.string().trim().min(1).max(4_000),
  projectOrInterest: z.string().trim().min(1).max(2_000),
  portfolioLinks: z.array(z.string().url().max(500)).max(30).default([]),
  taxonomyVersion: z.string().trim().min(1).max(40).optional(),
  canonicalTopicIds: z.array(idSchema).max(30).default([]),
  audience: audienceSchema,
  allowMatching: z.boolean(),
  acceptanceMode: z.enum(["manual", "full_autopilot"]),
  coarseLocation: z.string().trim().max(120).optional(),
  locationMapOptIn: z.boolean().default(true),
  timezone: z.string().trim().min(1).max(80).optional(),
  indexable: z.boolean().default(false),
  fields: z.array(z.object({
    key: z.enum(["current_work", "interests", "ambitions", "exploring", "networking_intent", "style_preferences", "personality_notes"]),
    value: z.string().trim().min(1).max(4_000),
    audience: audienceSchema,
    allowMatching: z.boolean(),
    provenance: z.enum(["self_reported", "codex_summary", "connected_app"]),
    sourceStatus: z.enum(["generated", "confirmed"]),
  }).strict()).max(20).default([]),
  statistics: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
    label: z.string().trim().min(1).max(50),
    value: z.string().trim().min(1).max(80),
    provenance: z.enum(["self_reported", "connected_app", "system"]),
    audience: audienceSchema,
  }).strict()).max(12).optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict();
