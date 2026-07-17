import { describe, expect, it } from "vitest";
import { withSecurityHeaders } from "../../apps/web/src/security/response-headers";

describe("Worker response security headers", () => {
  it("does not weaken route-specific isolation headers", () => {
    const response = new Response("raster", {
      headers: {
        "content-security-policy": "default-src 'none'; sandbox",
        "cross-origin-resource-policy": "same-site",
        "referrer-policy": "no-referrer",
      },
    });

    const secured = withSecurityHeaders(response, "request-1234");

    expect(secured.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(secured.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(secured.headers.get("referrer-policy")).toBe("no-referrer");
    expect(secured.headers.get("x-content-type-options")).toBe("nosniff");
    expect(secured.headers.get("x-request-id")).toBe("request-1234");
  });

  it("adds the document defaults when a route has no overrides", () => {
    const secured = withSecurityHeaders(new Response("document"), "request-5678");
    expect(secured.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
  });
});
