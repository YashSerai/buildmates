export function allowLocalTestingRoute(request: Request, binding: string | undefined): boolean {
  if (process.env.NODE_ENV === "production" || binding !== "1" || request.headers.get("x-buildmates-e2e") !== "1") return false;
  try {
    const { hostname, protocol } = new URL(request.url);
    return protocol === "http:" && (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]");
  } catch {
    return false;
  }
}
