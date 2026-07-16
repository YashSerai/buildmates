import { requireApiUser, isAuthResponse } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { apiError, getOnboardingSnapshot, revokeSource, saveSourcePolicies, type SourcePolicy } from "@/src/platform/onboarding-data";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET() {
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  return Response.json({ sources: (await getOnboardingSnapshot(DB, user.id, user.identity.displayName)).sources }, { headers: { "cache-control": "private, no-store" } });
}
export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request); if (originFailure) return originFailure;
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  try {
    const body = await request.json() as { sources?: Array<{ appId: string; displayName: string; category: string; accessMode: SourcePolicy }>; completeStep?: boolean };
    const { DB } = await getPlatformBindings();
    await saveSourcePolicies(DB, user.id, body.sources ?? [], body.completeStep === true);
    return Response.json({ sources: (await getOnboardingSnapshot(DB, user.id, user.identity.displayName)).sources }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  const originFailure = requireSameOriginMutation(request); if (originFailure) return originFailure;
  const user = await requireApiUser(); if (isAuthResponse(user)) return user;
  try {
    const body = await request.json() as { appId?: string };
    const { DB } = await getPlatformBindings();
    await revokeSource(DB, user.id, String(body.appId ?? ""));
    return Response.json({ revoked: true }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
