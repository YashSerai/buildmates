import {z} from "zod";
import {requireApiUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {requireSameOriginMutation} from "@/src/platform/same-origin";
import {acknowledgeRenewedRelevance,createReminder,dismissReminder,endConnection,getConnectionDetail,requestReconnect,respondReconnect,saveIntroductionFeedback,savePrivateNote,updateConnectionPreference} from "@/src/rooms/lifecycle";

const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("preference"),kind:z.enum(["muted","renewed_relevance","updates"]),enabled:z.boolean()}).strict(),
  z.object({action:z.literal("private_note"),body:z.string().max(4000)}).strict(),
  z.object({action:z.literal("reminder"),remindAt:z.number().int().positive()}).strict(),
  z.object({action:z.literal("dismiss_reminder"),reminderId:z.string().min(1).max(160)}).strict(),
  z.object({action:z.literal("end")}).strict(),
  z.object({action:z.literal("reconnect")}).strict(),
  z.object({action:z.literal("respond_reconnect"),requestId:z.string().min(1).max(160),response:z.enum(["accepted","declined"])}).strict(),
  z.object({action:z.literal("acknowledge_relevance")}).strict(),
  z.object({action:z.literal("feedback"),useful:z.boolean(),reasons:z.array(z.enum(["shared_context","good_conversation","future_relevance","collaboration_started","timing_off","not_relevant"])).max(6),similarMatchPreference:z.enum(["more","same","less"]).nullable(),followUpIntent:z.enum(["keep_connected","collaborate","not_now"]).nullable(),privateNote:z.string().max(2000).nullable()}).strict(),
]);

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const user=await requireApiUser();if(user instanceof Response)return user;try{const {id}=await params;const {DB}=await getPlatformBindings();return Response.json(await getConnectionDetail(DB,id,user.id),{headers:{"cache-control":"private, no-store"}})}catch{return Response.json({error:"connection_not_found"},{status:404})}}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(user instanceof Response)return user;const parsed=actionSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_request"},{status:400});const {id}=await params;const {DB}=await getPlatformBindings();const now=Date.now();try{let result:unknown={updated:true};const data=parsed.data;
  if(data.action==="preference")await updateConnectionPreference(DB,{connectionId:id,userId:user.id,kind:data.kind,enabled:data.enabled,now});
  else if(data.action==="private_note")await savePrivateNote(DB,{connectionId:id,userId:user.id,body:data.body,now});
  else if(data.action==="reminder")result=await createReminder(DB,{connectionId:id,userId:user.id,remindAt:data.remindAt,now});
  else if(data.action==="dismiss_reminder")await dismissReminder(DB,{connectionId:id,userId:user.id,reminderId:data.reminderId});
  else if(data.action==="end")await endConnection(DB,{connectionId:id,userId:user.id,now});
  else if(data.action==="reconnect")result=await requestReconnect(DB,{connectionId:id,userId:user.id,now});
  else if(data.action==="respond_reconnect")await respondReconnect(DB,{connectionId:id,userId:user.id,requestId:data.requestId,response:data.response,now});
  else if(data.action==="acknowledge_relevance")await acknowledgeRenewedRelevance(DB,{connectionId:id,userId:user.id,now});
  else await saveIntroductionFeedback(DB,{connectionId:id,userId:user.id,...data,now});
  return Response.json(result,{headers:{"cache-control":"private, no-store"}});
}catch(error){const code=error instanceof Error?error.message:"update_failed";return Response.json({error:code},{status:code.includes("not_found")?404:409})}}
