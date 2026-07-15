import { asUserId, type UserId } from "@buildmates/domain";
import { getPlatformIdentity, internalUserKey, requireApiIdentity, requirePlatformIdentity, type PlatformIdentity } from "../platform/identity";

export type AuthenticatedUser = { id: UserId; identity: PlatformIdentity };

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const identity = await getPlatformIdentity();
  return identity ? { id: asUserId(internalUserKey(identity)), identity } : null;
}

export async function requireUser(returnTo = "/home"): Promise<AuthenticatedUser> {
  const identity = await requirePlatformIdentity(returnTo);
  return { id: asUserId(internalUserKey(identity)), identity };
}

export async function requireApiUser(): Promise<AuthenticatedUser | Response> {
  const identity = await requireApiIdentity();
  return identity instanceof Response ? identity : { id: asUserId(internalUserKey(identity)), identity };
}

export function isAuthResponse(value: AuthenticatedUser | Response): value is Response {
  return value instanceof Response;
}
