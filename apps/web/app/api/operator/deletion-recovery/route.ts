import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { resumeAccountDeletion } from "@/src/privacy/account-deletion";

export async function GET() {
  const access = await operatorAccess();
  if (access instanceof Response) return access;
  const jobs = await access.DB.prepare("SELECT job.id,job.user_id AS userId,job.requested_at AS requestedAt,job.updated_at AS updatedAt FROM deletion_jobs job JOIN users user ON user.id=job.user_id WHERE job.status='deleting' AND user.status='deleting' ORDER BY job.updated_at LIMIT 50").all();
  return json({ jobs: jobs.results });
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const access = await operatorAccess();
  if (access instanceof Response) return access;
  const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
  if (!validJobId(body?.jobId)) return json({ error: "invalid_job_id" }, 400);
  try {
    return json(await resumeAccountDeletion(access.DB, access.ASSETS, body.jobId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "deletion_recovery_failed";
    return json({ error: ["deletion_job_not_found","deletion_job_not_recoverable"].includes(code) ? code : "deletion_recovery_failed" }, code === "deletion_job_not_found" ? 404 : 409);
  }
}

async function operatorAccess(): Promise<{DB:D1Database;ASSETS:Awaited<ReturnType<typeof getPlatformBindings>>["ASSETS"]} | Response> {
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const bindings = await getPlatformBindings();
  const operator = await bindings.DB.prepare("SELECT operator_role AS role FROM users WHERE id=? AND status='active' LIMIT 1").bind(user.id).first<{role:string}>();
  return operator?.role === "admin" ? bindings : json({ error: "operator_admin_required" }, 403);
}

function validJobId(value: unknown): value is string { return typeof value === "string" && /^deletion_[a-f0-9-]{36}$/i.test(value); }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "private, no-store", pragma: "no-cache" } }); }
