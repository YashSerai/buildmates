export function requireSameOriginMutation(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  let expected: string;
  try {
    expected = new URL(request.url).origin;
  } catch {
    return forbidden();
  }
  if (!origin || origin !== expected || (fetchSite && fetchSite !== "same-origin")) return forbidden();
  return null;
}

function forbidden(): Response {
  return Response.json({ error: "same_origin_required" }, { status: 403, headers: { "cache-control": "private, no-store" } });
}
