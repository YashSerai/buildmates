import {z} from "zod";
import {requireApiUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {requireSameOriginMutation} from "@/src/platform/same-origin";
import {appealModerationCase,listReporterStatus} from "@/src/moderation/service";
const appeal=z.object({caseId:z.string().min(1).max(160),statement:z.string().trim().min(20).max(3000)}).strict();
export async function GET(){const user=await requireApiUser();if(user instanceof Response)return user;const{DB}=await getPlatformBindings();return Response.json({reports:await listReporterStatus(DB,user.id)},{headers:{"cache-control":"private, no-store"}})}
export async function POST(request:Request){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(user instanceof Response)return user;const parsed=appeal.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_appeal"},{status:400});const{DB}=await getPlatformBindings();try{await appealModerationCase(DB,{userId:user.id,...parsed.data,now:Date.now()});return Response.json({received:true})}catch{return Response.json({error:"case_unavailable"},{status:404})}}
