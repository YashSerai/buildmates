import { z } from "zod";
import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { respondToProposal } from "@/src/matching/service";
const bodySchema=z.object({proposalId:z.string().min(1).max(160),response:z.enum(["interested","decline","undo"])}).strict();
export async function POST(request:Request){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(user instanceof Response)return user;const parsed=bodySchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_request"},{status:400});try{const {DB}=await getPlatformBindings();return Response.json(await respondToProposal(DB,{actorId:user.id,...parsed.data,now:Date.now()}),{headers:{"cache-control":"private, no-store"}})}catch(error){const code=error instanceof Error?error.message:"response_failed";return Response.json({error:code},{status:code.includes("unavailable")?409:400})}}
