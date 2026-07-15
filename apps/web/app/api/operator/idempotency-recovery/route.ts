import { inspectIdempotencyRecovery, recoverIdempotencyOperation, type RecoveryDisposition } from "@buildmates/mcp-core";
import { internalUserKey, requireApiIdentity } from "@/src/platform/identity";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET(request: Request) {
  const access = await operatorAccess();
  if (access instanceof Response) return access;
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!validId(id)) return json({ error: "invalid_id" }, 400);
  const inspection = await inspectIdempotencyRecovery(access.DB, id);
  return inspection ? json({ inspection }) : json({ error: "not_found" }, 404);
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const access = await operatorAccess();
  if (access instanceof Response) return access;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !validId(body.id) || !validHash(body.requestHash) || typeof body.reason !== "string" || body.reason.trim().length < 12 || !["no_effect", "completed_effect"].includes(String(body.disposition))) return json({ error: "invalid_request" }, 400);
  const disposition = body.disposition as RecoveryDisposition;
  const effect = body.effectLocator as Record<string, unknown> | undefined;
  const effectLocator = effect && validToken(effect.kind) && validId(effect.id) ? { kind: String(effect.kind), id: String(effect.id) } : undefined;
  if ((disposition === "completed_effect") !== Boolean(effectLocator)) return json({ error: disposition === "completed_effect" ? "effect_locator_required" : "effect_locator_not_allowed" }, 400);
  try {
    const recovered = await recoverIdempotencyOperation(access.DB, {
      id: String(body.id), requestHash: String(body.requestHash), operatorUserId: access.userId,
      reason: body.reason.trim(), disposition, effectLocator, at: new Date(), auditId: crypto.randomUUID(),
    });
    return recovered ? json({ recovered: true }) : json({ error: "recovery_conflict" }, 409);
  } catch (error) {
    const message = error instanceof Error ? error.message : "recovery_failed";
    return json({ error: ["effect_locator_not_verifiable", "effect_locator_required", "effect_locator_not_allowed", "recovery_metadata_invalid"].includes(message) ? message : "recovery_failed" }, 400);
  }
}

async function operatorAccess(): Promise<{ DB: D1Database; userId: string } | Response> {
  const identity = await requireApiIdentity();
  if (identity instanceof Response) return identity;
  const { DB } = await getPlatformBindings();
  const userId = internalUserKey(identity);
  const user = await DB.prepare("SELECT operator_role AS role FROM users WHERE id=? AND status='active' LIMIT 1").bind(userId).first<{ role: string }>();
  return user?.role === "admin" ? { DB, userId } : json({ error: "operator_admin_required" }, 403);
}

function validId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{2,127}$/.test(value); }
function validToken(value: unknown): value is string { return typeof value === "string" && /^[a-z_]{3,64}$/.test(value); }
function validHash(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value); }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "private, no-store", pragma: "no-cache" } }); }
