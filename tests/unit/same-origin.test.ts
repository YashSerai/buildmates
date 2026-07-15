import { describe, expect, it } from "vitest";
import { requireSameOriginMutation } from "../../apps/web/src/platform/same-origin";

describe("same-origin mutation enforcement", () => {
  it("accepts an exact same-origin browser mutation", () => {
    const request = new Request("https://buildmates.example/api/identity/link-code", { method: "POST", headers: { origin: "https://buildmates.example", "sec-fetch-site": "same-origin" } });
    expect(requireSameOriginMutation(request)).toBeNull();
  });

  it.each([
    [{}, 403],
    [{ origin: "https://attacker.example", "sec-fetch-site": "cross-site" }, 403],
    [{ origin: "https://buildmates.example", "sec-fetch-site": "same-site" }, 403],
  ])("rejects missing or non-same-origin mutation headers", (headers, status) => {
    const request = new Request("https://buildmates.example/api/identity/link-code", { method: "DELETE", headers });
    expect(requireSameOriginMutation(request)?.status).toBe(status);
  });
});
