import { requireApiUser, isAuthResponse } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { apiError, getOnboardingSnapshot, mutateOnboarding } from "@/src/platform/onboarding-data";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET() {
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const { DB } = await getPlatformBindings();
  return Response.json(await getOnboardingSnapshot(DB, user.id, user.identity.displayName), { headers: privateHeaders() });
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { DB } = await getPlatformBindings();
    await mutateOnboarding(DB, user.id, user.identity.displayName, body);
    return Response.json(await getOnboardingSnapshot(DB, user.id, user.identity.displayName), { headers: privateHeaders() });
  } catch (error) {
    return apiError(error);
  }
}

function privateHeaders(): HeadersInit { return { "cache-control": "private, no-store", pragma: "no-cache", vary: "oai-authenticated-user-id" }; }
