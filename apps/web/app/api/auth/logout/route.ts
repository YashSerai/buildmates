import { SESSION_COOKIE, sessionCookie, sha256 } from "@/src/auth/github-oauth";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const value = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  const [id, secret] = value.split(".");
  if (id && secret) {
    const { DB } = await getPlatformBindings();
    await DB.prepare("UPDATE web_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND token_hash=?")
      .bind(Date.now(), id, await sha256(secret)).run();
  }
  return new Response(null, { status: 204, headers: { "set-cookie": sessionCookie("", 0), "cache-control": "no-store" } });
}
function readCookie(header: string | null, name: string): string { const value = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1); try { return value ? decodeURIComponent(value) : ""; } catch { return ""; } }
