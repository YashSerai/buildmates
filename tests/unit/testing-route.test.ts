import { afterEach, describe, expect, it, vi } from "vitest";
import { allowLocalTestingRoute } from "../../apps/web/src/security/testing-route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("synthetic testing-route boundary", () => {
  it("allows an explicitly enabled local HTTP request outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const request = new Request("http://127.0.0.1:3000/api/testing/session", { headers: { "x-buildmates-e2e": "1" } });
    expect(allowLocalTestingRoute(request, "1")).toBe(true);
  });

  it.each([
    ["https://buildmates.yashns.chatgpt.site/api/testing/session", "test", "1", "1"],
    ["http://127.0.0.1:3000/api/testing/session", "production", "1", "1"],
    ["http://127.0.0.1:3000/api/testing/session", "test", "0", "1"],
    ["http://127.0.0.1:3000/api/testing/session", "test", "1", "0"],
  ])("rejects non-local, production, disabled, or missing-header requests", (url, nodeEnv, binding, header) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    const request = new Request(url, { headers: { "x-buildmates-e2e": header } });
    expect(allowLocalTestingRoute(request, binding)).toBe(false);
  });
});
