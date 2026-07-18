export type ActivityNotification = {
  kind: string;
  payload: Record<string, unknown>;
};

export function notificationLabel(kind: string): string {
  return ({
    match_interest: "Someone is interested",
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
  const builderName = payloadText(item.payload, "builderName");
  const senderName = payloadText(item.payload, "senderName") ?? builderName;
  const circleName = payloadText(item.payload, "circleName");
  const projectTitle = payloadText(item.payload, "projectTitle");
  const moduleName = payloadText(item.payload, "moduleName");
  if (item.kind === "match_interest") return builderName ? `${builderName} is interested in meeting you.` : "Someone on your shortlist is interested in meeting you.";
  if (item.kind === "match_opened") return builderName ? `Your private introduction room with ${builderName} is ready.` : "Your private introduction room is ready.";
  if (item.kind === "new_message") return senderName ? `${senderName} sent you a message.` : "A connection sent you a message.";
  if (item.kind === "circle_message") return circleName ? `There is a new message in ${circleName}.` : "A member posted in your Circle.";
  if (item.kind === "circle_invitation") return circleName ? `You were invited to ${circleName}.` : "You were invited to a Circle.";
  if (item.kind === "project_collaboration_invite") return projectTitle ? `You were invited to collaborate on ${projectTitle}.` : "You were invited to collaborate on a project.";
  if (item.kind === "meeting_proposed") return senderName ? `${senderName} proposed a time to talk.` : "A connection proposed a time to talk.";
  if (item.kind === "meeting_response") return item.payload.response === "accepted" ? "Your meeting proposal was accepted." : "Your meeting proposal was declined.";
  if (item.kind === "connection_reminder") return "Your private reminder to reconnect is due.";
  if (item.kind === "reconnect_requested") return builderName ? `${builderName} wants to reconnect.` : "A previous connection wants to reconnect.";
  if (item.kind === "renewed_relevance") return projectTitle ? `${projectTitle} may be relevant to your work now.` : "A connection published work that may be relevant to you again.";
  if (item.kind === "room_upgraded") return moduleName ? `${moduleName} is now active in your room.` : "A shared tool is now active in your room.";
  if (item.kind === "moderation_outcome") return "A safety review has an update for your account.";
  return "There is new activity in Buildmates.";
}

function payloadText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 160) : null;
}

export function notificationDestination(item: ActivityNotification): { href: string; label: string } | null {
  if (typeof item.payload.roomId === "string") return { href: `/rooms/${encodeURIComponent(item.payload.roomId)}`, label: item.kind.startsWith("meeting_") ? "Review time" : "Open room" };
  if (typeof item.payload.circleId === "string") return { href: `/circles/${encodeURIComponent(item.payload.circleId)}`, label: "Open Circle" };
  if (typeof item.payload.connectionId === "string") return { href: `/connections#${encodeURIComponent(item.payload.connectionId)}`, label: "Open connection" };
  if (item.kind === "project_collaboration_invite" && typeof item.payload.slug === "string") return { href: `/projects/${encodeURIComponent(item.payload.slug)}/collaboration`, label: "Review project invitation" };
  if (item.kind.includes("match")) return { href: "/matches", label: "Review introduction" };
  return null;
}
