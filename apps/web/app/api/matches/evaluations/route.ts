import { z } from "zod";
import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { evaluateCandidate } from "@/src/matching/service";
const bodySchema=z.object({batchId:z.string().min(1).max(160),candidateUserId:z.string().min(1).max(160),decision:z.enum(["approve","decline","defer"]),reasonSummary:z.string().trim().min(1).max(600),indexVersion:z.number().int().positive(),evidenceIds:z.array(z.string().min(1).max(200)).max(50).default([])}).strict();
export async function POST(request:Request){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(user instanceof Response)return user;const parsed=bodySchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_request"},{status:400});try{const {DB}=await getPlatformBindings();return Response.json(await evaluateCandidate(DB,{actorId:user.id,...parsed.data,now:Date.now()}),{status:201,headers:{"cache-control":"private, no-store"}})}catch(error){const code=error instanceof Error?error.message:"evaluation_failed";return Response.json({error:code},{status:code.includes("stale")?409:code.includes("forbidden")?403:400})}}
