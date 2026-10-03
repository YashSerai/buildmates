import { z } from "zod";
import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { createCircle, listCircles, listCircleSuggestions } from "@/src/circles/service";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  purpose: z.string().trim().min(10).max(600),
  governanceMode: z.enum(["admin", "vote"]),
  inviteeUserIds: z.array(z.string().min(1).max(160)).max(20).optional(),
}).strict();

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const { DB } = await getPlatformBindings();
  const [circles, suggestions] = await Promise.all([listCircles(DB, user.id), listCircleSuggestions(DB, user.id)]);
  return Response.json({ circles, suggestions }, { headers: { "cache-control": "private, no-store" } });
}
export async function POST(request: Request) {
  const origin = requireSameOriginMutation(request);
  if (origin) return origin;
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_circle" }, { status: 400 });
  try {
    const { DB } = await getPlatformBindings();
    return Response.json(await createCircle(DB, { actorId: user.id, ...parsed.data, now: Date.now() }), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "circle_create_failed";
    return Response.json({ error: code }, { status: code === "circle_create_rate_limited" ? 429 : 400 });
  }
}
