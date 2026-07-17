import { describe, expect, it } from "vitest";
import { safeRoute } from "../../apps/web/src/observability/events";

describe("request event redaction", () => {
  it("never records bearer invite tokens in route logs", () => {
    const token = "GqfY2R4sUDhY7nV45bQmKxLz7Z8aP1cD";
    expect(safeRoute(`/i/${token}`)).toBe("/i/:token");
    expect(safeRoute(`/i/${token}/accept`)).toBe("/i/:token/accept");
    expect(safeRoute(`/rooms/room_1234567890abcdef/messages`)).toBe("/rooms/:id/messages");
  });
});
