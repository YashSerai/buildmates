import type { CircleId, CohortId, ProfileId, RoomId, UserId } from "./ids";
import { z } from "zod";

export const AUDIENCES = ["public", "signed_in", "suggested_connections", "mutual_connections", "private"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const ACCEPTANCE_MODES = ["manual", "full_autopilot"] as const;
export type AcceptanceMode = (typeof ACCEPTANCE_MODES)[number];
export const APP_ACCESS_MODES = ["never", "ask_each_time", "approved_summaries"] as const;
export type AppAccessMode = (typeof APP_ACCESS_MODES)[number];
export const MEMBER_ROLES = ["member", "admin", "owner"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const CONNECTION_STATES = ["active", "ended", "blocked"] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const audienceSchema = z.enum(AUDIENCES);
export const acceptanceModeSchema = z.enum(ACCEPTANCE_MODES);
export const appAccessModeSchema = z.enum(APP_ACCESS_MODES);
export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const connectionStateSchema = z.enum(CONNECTION_STATES);

export type User = {
  id: UserId;
  status: "active" | "restricted" | "suspended" | "deleting" | "deleted";
  operatorRole: "none" | "moderator" | "admin";
  createdAt: Date;
};

export type Profile = {
  id: ProfileId;
  userId: UserId;
  handle: string;
  displayName: string;
  summary: string;
  audience: Audience;
  cohortScopeId: CohortId | null;
  allowMatching: boolean;
  acceptanceMode: AcceptanceMode;
};

export type Room = { id: RoomId; matchPairId: string; status: "active" | "ended" | "deleted" };
export type Circle = { id: CircleId; name: string; governanceVersion: number };
export type Cohort = { id: CohortId; slug: string; visibility: "public" | "request" | "invite" | "private" };

export function isAudience(value: string): value is Audience {
  return audienceSchema.safeParse(value).success;
}

export function isAcceptanceMode(value: string): value is AcceptanceMode {
  return acceptanceModeSchema.safeParse(value).success;
}
