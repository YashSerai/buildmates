import { beginGithubLogin, oauthCookie } from "@/src/auth/github-oauth";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const login = await beginGithubLogin(url.searchParams.get("return_to") || "/account", url.origin);
    return new Response(null, { status: 302, headers: { location: login.authorizeUrl, "set-cookie": oauthCookie(login.state), "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  } catch {
    return Response.json({ error: "github_login_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
