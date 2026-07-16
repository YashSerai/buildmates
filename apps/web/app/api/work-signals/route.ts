import { requireApiUser, isAuthResponse } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { apiError, getOnboardingSnapshot, updateWorkSignal } from "@/src/platform/onboarding-data";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET() {
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  return Response.json({ signals: (await getOnboardingSnapshot(DB, user.id, user.identity.displayName)).signals }, { headers: { "cache-control": "private, no-store" } });
}
export async function PATCH(request: Request) { return mutate(request); }
export async function DELETE(request: Request) { return mutate(request, "delete"); }
async function mutate(request: Request, forcedAction?: string) {
  const originFailure = requireSameOriginMutation(request); if (originFailure) return originFailure;
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { DB } = await getPlatformBindings();
    await updateWorkSignal(DB, user.id, forcedAction ? { ...body, action: forcedAction } : body);
    return Response.json({ signals: (await getOnboardingSnapshot(DB, user.id, user.identity.displayName)).signals }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
