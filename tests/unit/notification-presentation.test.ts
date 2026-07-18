import { describe, expect, it } from "vitest";
import { notificationDestination, notificationLabel, notificationSummary } from "../../apps/web/src/activity/notification-presentation";

describe("Activity notification presentation", () => {
  it("gives each supported notification a clear label and summary", () => {
    expect(notificationLabel("new_message")).toBe("New message");
    expect(notificationSummary({ kind: "meeting_response", payload: { response: "accepted" } })).toBe("Your meeting proposal was accepted.");
    expect(notificationSummary({ kind: "unknown", payload: {} })).toBe("There is new activity in Buildmates.");
  });

  it("routes activity to the bounded resource represented by its payload", () => {
    expect(notificationDestination({ kind: "new_message", payload: { roomId: "room/a" } })).toEqual({ href: "/rooms/room%2Fa", label: "Open room" });
    expect(notificationDestination({ kind: "meeting_proposed", payload: { roomId: "room-1" } })).toEqual({ href: "/rooms/room-1", label: "Review time" });
    expect(notificationDestination({ kind: "circle_invitation", payload: { circleId: "circle-1" } })).toEqual({ href: "/circles/circle-1", label: "Open Circle" });
    expect(notificationDestination({ kind: "renewed_relevance", payload: { connectionId: "connection-1" } })).toEqual({ href: "/connections#connection-1", label: "Open connection" });
    expect(notificationDestination({ kind: "project_collaboration_invite", payload: { slug: "project/a" } })).toEqual({ href: "/projects/project%2Fa/collaboration", label: "Review project invitation" });
    expect(notificationDestination({ kind: "match_opened", payload: {} })).toEqual({ href: "/matches", label: "Review introduction" });
  });
});
