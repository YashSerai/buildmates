import type { Audience, MemberRole } from "./types";
import type { UserId } from "./ids";

export type AuthorizationContext = {
  actorId: UserId | null;
  ownerId?: UserId;
  roomMemberIds?: readonly UserId[];
  circleRole?: MemberRole | null;
  sameCohort?: boolean;
  suggestedConnection?: boolean;
  mutualConnection?: boolean;
  blocked?: boolean;
};

export type Action =
  | "read_profile"
  | "read_private_resource"
  | "mutate_owned_resource"
  | "read_room"
  | "write_room"
  | "read_circle"
  | "manage_circle"
  | "delete_circle";

export function can(action: Action, context: AuthorizationContext, audience: Audience = "private", cohortScoped = false): boolean {
  const actor = context.actorId;
  const isOwner = Boolean(actor && context.ownerId === actor);
  if (context.blocked && !isOwner) return false;

  switch (action) {
    case "read_profile":
      if (isOwner) return true;
      if (cohortScoped && !context.sameCohort) return false;
      return audience === "public" || (audience === "signed_in" && Boolean(actor)) ||
        (audience === "suggested_connections" && Boolean(actor && context.suggestedConnection)) ||
        (audience === "mutual_connections" && Boolean(actor && context.mutualConnection));
    case "read_private_resource":
    case "mutate_owned_resource":
      return isOwner;
    case "read_room":
    case "write_room":
      return Boolean(actor && context.roomMemberIds?.includes(actor));
    case "read_circle":
      return Boolean(actor && context.circleRole);
    case "manage_circle":
      return Boolean(actor) && (context.circleRole === "admin" || context.circleRole === "owner");
    case "delete_circle":
      return Boolean(actor) && context.circleRole === "owner";
  }
}

export function assertAuthorized(
  action: Action,
  context: AuthorizationContext,
  audience: Audience = "private",
  cohortScoped = false,
): void {
  if (!can(action, context, audience, cohortScoped)) throw new AuthorizationError(action);
}

export class AuthorizationError extends Error {
  readonly code = "forbidden";
  constructor(action: Action) {
    super(`Not authorized to ${action}`);
    this.name = "AuthorizationError";
  }
}
