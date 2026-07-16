import { requireApiUser, isAuthResponse } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { apiError, getOnboardingSnapshot, runPrivacyCommand } from "@/src/platform/onboarding-data";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET() {
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  return Response.json(await getOnboardingSnapshot(DB, user.id, user.identity.displayName), { headers: { "cache-control": "private, no-store" } });
}
export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request); if (originFailure) return originFailure;
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { DB, ASSETS } = await getPlatformBindings();
    const result = await runPrivacyCommand(DB, user.id, body, ASSETS);
    return Response.json({ ...result, snapshot: await getOnboardingSnapshot(DB, user.id, user.identity.displayName) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
