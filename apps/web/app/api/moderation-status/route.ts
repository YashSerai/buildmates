import {z} from "zod";
import {requireAppealApiIdentity} from "@/src/platform/identity";
import {getPlatformBindings} from "@/src/platform/bindings";
import {requireSameOriginMutation} from "@/src/platform/same-origin";
import {appealModerationCase,listAppealableOutcomes,listReporterStatus} from "@/src/moderation/service";
const appeal=z.object({caseId:z.string().min(1).max(160),statement:z.string().trim().min(20).max(3000)}).strict();
export async function GET(){const identity=await requireAppealApiIdentity();if(identity instanceof Response)return identity;const{DB}=await getPlatformBindings();return Response.json({reports:await listReporterStatus(DB,identity.userId),outcomes:await listAppealableOutcomes(DB,identity.userId),accountStatus:identity.accountStatus},{headers:{"cache-control":"private, no-store"}})}
export async function POST(request:Request){const origin=requireSameOriginMutation(request);if(origin)return origin;const identity=await requireAppealApiIdentity();if(identity instanceof Response)return identity;const parsed=appeal.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_appeal"},{status:400});const{DB}=await getPlatformBindings();try{await appealModerationCase(DB,{userId:identity.userId,...parsed.data,now:Date.now()});return Response.json({received:true})}catch{return Response.json({error:"case_unavailable"},{status:404})}}
