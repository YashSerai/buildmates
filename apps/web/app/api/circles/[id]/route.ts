import { z } from "zod";
import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { addCircleModuleEntry, createCircleProposal, deleteCircleModuleEntry, getCircle, inviteCircleMemberByHandle, leaveCircle, listCircleMessages, listCircleModuleEntries, manageCircleMember, publishCircleProposal, respondCircleInvite, sendCircleMessage, updateCircleModuleEntry, voteCircleProposal } from "@/src/circles/service";

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), handle: z.string().trim().min(1).max(64) }).strict(),
  z.object({ action: z.literal("respond_invite"), accept: z.boolean() }).strict(),
  z.object({ action: z.literal("propose"), kind: z.enum(["design", "module", "rules"]), payload: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.literal("vote"), proposalId: z.string().min(1).max(160), vote: z.enum(["approve", "reject", "abstain"]) }).strict(),
  z.object({ action: z.literal("publish"), proposalId: z.string().min(1).max(160) }).strict(),
  z.object({ action: z.literal("add_entry"), moduleId: z.string().min(1).max(160), payload: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.literal("update_entry"), moduleId: z.string().min(1).max(160), entryId: z.string().min(1).max(160), payload: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ action: z.literal("delete_entry"), moduleId: z.string().min(1).max(160), entryId: z.string().min(1).max(160) }).strict(),
  z.object({ action: z.literal("send_message"), clientMessageId: z.string().min(1).max(160), body: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ action: z.literal("manage_member"), targetUserId: z.string().min(1).max(160), memberAction: z.enum(["promote", "demote", "remove", "transfer"]) }).strict(),
  z.object({ action: z.literal("leave") }).strict(),
]);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { id } = await params;
  const { DB } = await getPlatformBindings();
  const circle = await getCircle(DB, id, user.id);
  if (!circle) return Response.json({ error: "not_found" }, { status: 404 });
  const messages = circle.membershipStatus === "active" && circle.status === "active" ? await listCircleMessages(DB, id, user.id) : [];
  const entries = circle.membershipStatus === "active" && circle.status === "active" ? await listCircleModuleEntries(DB, id, user.id) : [];
  return Response.json({ circle, messages, entries }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = requireSameOriginMutation(request);
  if (origin) return origin;
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const parsed = command.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_command" }, { status: 400 });
  const { id } = await params;
  const { DB } = await getPlatformBindings();
  try {
    let result: unknown = { ok: true };
    const input = parsed.data;
    if (input.action === "invite") await inviteCircleMemberByHandle(DB, { actorId: user.id, circleId: id, handle: input.handle, now: Date.now() });
    else if (input.action === "respond_invite") await respondCircleInvite(DB, { actorId: user.id, circleId: id, accept: input.accept, now: Date.now() });
    else if (input.action === "propose") result = await createCircleProposal(DB, { actorId: user.id, circleId: id, kind: input.kind, payload: input.payload, now: Date.now() });
    else if (input.action === "vote") await voteCircleProposal(DB, { actorId: user.id, circleId: id, proposalId: input.proposalId, vote: input.vote, now: Date.now() });
    else if (input.action === "publish") await publishCircleProposal(DB, { actorId: user.id, circleId: id, proposalId: input.proposalId, now: Date.now() });
    else if (input.action === "add_entry") result = await addCircleModuleEntry(DB, { actorId: user.id, circleId: id, moduleId: input.moduleId, payload: input.payload, now: Date.now() });
    else if (input.action === "update_entry") await updateCircleModuleEntry(DB, { actorId: user.id, circleId: id, moduleId: input.moduleId, entryId: input.entryId, payload: input.payload, now: Date.now() });
    else if (input.action === "delete_entry") await deleteCircleModuleEntry(DB, { actorId: user.id, circleId: id, moduleId: input.moduleId, entryId: input.entryId, now: Date.now() });
    else if (input.action === "send_message") result = await sendCircleMessage(DB, { actorId: user.id, circleId: id, clientMessageId: input.clientMessageId, body: input.body, now: Date.now() });
    else if (input.action === "manage_member") await manageCircleMember(DB, { actorId: user.id, circleId: id, targetUserId: input.targetUserId, action: input.memberAction });
    else await leaveCircle(DB, { actorId: user.id, circleId: id });
    return Response.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "circle_command_failed";
    return Response.json({ error: code }, { status: code === "forbidden" ? 403 : code.includes("not_found") || code.includes("unavailable") ? 404 : 409 });
  }
}
