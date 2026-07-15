import { assertAuthorized, type Action, type Audience, type AuthorizationContext } from "@buildmates/domain";

export function authorize(action: Action, context: AuthorizationContext, audience: Audience = "private", cohortScoped = false): void {
  assertAuthorized(action, context, audience, cohortScoped);
}

export function forbiddenResponse(): Response {
  return Response.json({ error: "forbidden" }, { status: 403 });
}

export async function authorizedResponse<T>(operation: () => Promise<T>): Promise<Response> {
  try { return Response.json(await operation()); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "forbidden") return forbiddenResponse();
    throw error;
  }
}
