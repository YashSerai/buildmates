import { finishGithubLogin, oauthCookie, OAUTH_COOKIE, sessionCookie } from "@/src/auth/github-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = readCookie(request.headers.get("cookie"), OAUTH_COOKIE);
  if (!code || !state || !stateCookie) return authFailure(url.origin, "invalid_request");
  try {
    const result = await finishGithubLogin({ code, state, stateCookie, origin: url.origin });
    const headers = new Headers({ location: new URL(result.returnTo, url.origin).toString(), "cache-control": "no-store", "referrer-policy": "no-referrer" });
    headers.append("set-cookie", sessionCookie(result.cookieValue));
    headers.append("set-cookie", oauthCookie("", 0));
    return new Response(null, { status: 302, headers });
  } catch {
    return authFailure(url.origin, "authentication_failed");
  }
}

function authFailure(origin: string, reason: string): Response { const target = new URL("/account", origin); target.searchParams.set("auth_error", reason); return new Response(null, { status: 302, headers: { location: target.toString(), "set-cookie": oauthCookie("", 0), "cache-control": "no-store" } }); }
function readCookie(header: string | null, name: string): string { const value = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1); try { return value ? decodeURIComponent(value) : ""; } catch { return ""; } }
