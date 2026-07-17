const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org",
  "frame-src 'self' blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export function withSecurityHeaders(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  // Route handlers may deliberately return a policy that is stricter than the
  // document default. Surface assets, for example, are inert raster responses
  // with `default-src 'none'; sandbox` and `no-referrer`. Never weaken those
  // headers at the Worker boundary.
  setDefault(headers, "content-security-policy", CONTENT_SECURITY_POLICY);
  setDefault(headers, "cross-origin-opener-policy", "same-origin");
  setDefault(headers, "cross-origin-resource-policy", "same-origin");
  setDefault(headers, "permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  setDefault(headers, "referrer-policy", "strict-origin-when-cross-origin");
  setDefault(headers, "x-content-type-options", "nosniff");
  setDefault(headers, "x-frame-options", "DENY");
  headers.set("x-request-id", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function setDefault(headers: Headers, name: string, value: string): void {
  if (!headers.has(name)) headers.set(name, value);
}
