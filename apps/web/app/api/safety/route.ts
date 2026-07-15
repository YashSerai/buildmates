import { z } from "zod";
import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { blockBuilder, listBlockedBuilders, reportTarget, unblockBuilder } from "@/src/safety/service";

const command=z.discriminatedUnion("action",[
  z.object({action:z.literal("block"),targetUserId:z.string().min(1).max(160)}).strict(),
  z.object({action:z.literal("unblock"),targetUserId:z.string().min(1).max(160)}).strict(),
  z.object({action:z.literal("report"),targetKind:z.enum(["user","profile","project","room","circle","message"]),targetId:z.string().min(1).max(160),reasonCode:z.enum(["spam","harassment","impersonation","unsafe_content","privacy","other"]),details:z.string().trim().max(2000).optional()}).strict(),
]);
export async function GET(){const user=await requireApiUser();if(user instanceof Response)return user;const{DB}=await getPlatformBindings();return Response.json({blocked:await listBlockedBuilders(DB,user.id)},{headers:{"cache-control":"private, no-store"}})}
export async function POST(request:Request){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(user instanceof Response)return user;const parsed=command.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_command"},{status:400});const{DB}=await getPlatformBindings();try{const now=Date.now();if(parsed.data.action==="block")await blockBuilder(DB,{actorId:user.id,targetUserId:parsed.data.targetUserId,now});else if(parsed.data.action==="unblock")await unblockBuilder(DB,{actorId:user.id,targetUserId:parsed.data.targetUserId,now});else return Response.json(await reportTarget(DB,{actorId:user.id,...parsed.data,now}),{status:201});return Response.json({ok:true})}catch(error){const code=error instanceof Error?error.message:"safety_command_failed";return Response.json({error:code},{status:code.endsWith("not_found")?404:409})}}
