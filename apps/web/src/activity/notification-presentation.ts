export type ActivityNotification = {
  kind: string;
  payload: Record<string, unknown>;
};

export function notificationLabel(kind: string): string {
  return ({
    match_opened: "Introduction ready",
    new_message: "New message",
    circle_message: "Circle message",
    circle_invitation: "Circle invitation",
    project_collaboration_invite: "Project invitation",
    meeting_proposed: "Meeting proposal",
    meeting_response: "Meeting update",
    connection_reminder: "Reconnect reminder",
    reconnect_requested: "Reconnect request",
    renewed_relevance: "Relevant again",
    room_upgraded: "Room upgraded",
    moderation_outcome: "Safety review",
  } as Record<string, string>)[kind] ?? "Buildmates activity";
}

export function notificationSummary(item: ActivityNotification): string {
  if (item.kind === "match_opened") return "Your private introduction room is ready.";
  if (item.kind === "new_message") return "A connection sent you a message.";
  if (item.kind === "circle_message") return "A member posted in your Circle.";
  if (item.kind === "circle_invitation") return "You were invited to a Circle.";
  if (item.kind === "project_collaboration_invite") return "You were invited to collaborate on a project.";
  if (item.kind === "meeting_proposed") return "A Connection proposed a time to talk.";
  if (item.kind === "meeting_response") return item.payload.response === "accepted" ? "Your meeting proposal was accepted." : "Your meeting proposal was declined.";
  if (item.kind === "connection_reminder") return "Your private reminder to reconnect is due.";
  if (item.kind === "reconnect_requested") return "A previous Connection wants to reconnect.";
  if (item.kind === "renewed_relevance") return "A Connection published work that may be relevant to you again.";
  if (item.kind === "room_upgraded") return "A shared tool is now active in your room.";
  if (item.kind === "moderation_outcome") return "A safety review has an update for your account.";
  return "There is new activity in Buildmates.";
}

export function notificationDestination(item: ActivityNotification): { href: string; label: string } | null {
  if (typeof item.payload.roomId === "string") return { href: `/rooms/${encodeURIComponent(item.payload.roomId)}`, label: item.kind.startsWith("meeting_") ? "Review time" : "Open room" };
  if (typeof item.payload.circleId === "string") return { href: `/circles/${encodeURIComponent(item.payload.circleId)}`, label: "Open Circle" };
  if (typeof item.payload.connectionId === "string") return { href: `/connections#${encodeURIComponent(item.payload.connectionId)}`, label: "Open connection" };
  if (item.kind === "project_collaboration_invite" && typeof item.payload.slug === "string") return { href: `/projects/${encodeURIComponent(item.payload.slug)}/collaboration`, label: "Review project invitation" };
  if (item.kind.includes("match")) return { href: "/matches", label: "Review introduction" };
  return null;
}
