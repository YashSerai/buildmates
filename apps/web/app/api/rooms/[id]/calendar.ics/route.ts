import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getRoomSummary } from "@/src/rooms/service";
import { getAcceptedMeetingForIcs } from "@/src/rooms/lifecycle";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const { DB } = await getPlatformBindings();
  const room = await getRoomSummary(DB, id, user.id);
  if (!room) return new Response("Not found", { status: 404 });

  const proposalId = new URL(request.url).searchParams.get("proposal");
  if (!proposalId || proposalId.length > 160) return Response.json({ error: "accepted_proposal_required" }, { status: 400 });
  let proposal: { startsAt: number; endsAt: number; timezone: string };
  try { proposal = await getAcceptedMeetingForIcs(DB, { roomId: id, proposalId, userId: user.id }); }
  catch { return Response.json({ error: "accepted_proposal_required" }, { status: 404 }); }

  const stamp = format(new Date());
  const text = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Buildmates//Room scheduling//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${safeName(id)}-${safeName(proposalId)}@buildmates`, `DTSTAMP:${stamp}`, `DTSTART:${format(new Date(proposal.startsAt))}`, `DTEND:${format(new Date(proposal.endsAt))}`,
    "STATUS:CONFIRMED", `SUMMARY:Buildmates conversation with ${escapeIcs(room.otherName)}`,
    `DESCRIPTION:${escapeIcs(`Agreed in Buildmates. Original timezone: ${proposal.timezone}.`)}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return new Response(text, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="buildmates-${safeName(room.otherName)}.ics"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

function format(date: Date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function escapeIcs(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function safeName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "meeting"; }
