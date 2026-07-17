import {z} from "zod";
import {requireApiUser} from "@/src/auth/require-user";
import {getPlatformBindings} from "@/src/platform/bindings";
import {requireSameOriginMutation} from "@/src/platform/same-origin";
import {addRoomModuleEntry,deleteRoomModuleEntry,listRoomEnhancements,markRoomRead,proposeMeeting,proposeRoomUpgrade,respondMeeting,respondRoomUpgrade,saveAvailabilityWindow,updateRoomModuleEntry,withdrawAvailabilityWindow} from "@/src/rooms/lifecycle";
const moduleKind=z.enum(["resource_shelf","experiment_tracker","decision_log","feedback_queue","milestone_tracker"]);
const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("read"),messageId:z.string().min(1).max(160).nullable()}).strict(),
  z.object({action:z.literal("propose_upgrade"),modules:z.array(moduleKind).min(1).max(5),explanation:z.string().trim().min(1).max(1000)}).strict(),
  z.object({action:z.literal("respond_upgrade"),proposalId:z.string().min(1).max(160),response:z.enum(["accepted","declined"])}).strict(),
  z.object({action:z.literal("add_module_entry"),moduleId:z.string().min(1).max(160),payload:z.record(z.string(),z.unknown())}).strict(),
  z.object({action:z.literal("update_module_entry"),moduleId:z.string().min(1).max(160),entryId:z.string().min(1).max(160),payload:z.record(z.string(),z.unknown())}).strict(),
  z.object({action:z.literal("delete_module_entry"),moduleId:z.string().min(1).max(160),entryId:z.string().min(1).max(160)}).strict(),
  z.object({action:z.literal("propose_meeting"),clientRequestId:z.string().min(8).max(120),startsAt:z.number().int().positive(),endsAt:z.number().int().positive(),timezone:z.string().min(1).max(80),note:z.string().max(1000).nullable(),parentProposalId:z.string().max(160).nullable().optional()}).strict(),
  z.object({action:z.literal("respond_meeting"),proposalId:z.string().min(1).max(160),response:z.enum(["accepted","declined"])}).strict(),
  z.object({action:z.literal("save_availability"),clientWindowId:z.string().min(8).max(120),startsAt:z.number().int().positive(),endsAt:z.number().int().positive(),timezone:z.string().min(1).max(80)}).strict(),
  z.object({action:z.literal("withdraw_availability"),windowId:z.string().min(1).max(200)}).strict(),
]);
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const user=await requireApiUser();if(user instanceof Response)return user;try{const {id}=await params;const {DB}=await getPlatformBindings();return Response.json(await listRoomEnhancements(DB,id,user.id),{headers:{"cache-control":"private, no-store"}})}catch{return Response.json({error:"room_not_found"},{status:404})}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(user instanceof Response)return user;const parsed=actionSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"invalid_request"},{status:400});const {id}=await params;const {DB}=await getPlatformBindings();const now=Date.now();try{let result:unknown={updated:true};const data=parsed.data;
  if(data.action==="read")await markRoomRead(DB,{roomId:id,userId:user.id,messageId:data.messageId,now});
  else if(data.action==="propose_upgrade")result=await proposeRoomUpgrade(DB,{roomId:id,userId:user.id,modules:data.modules,explanation:data.explanation,now});
  else if(data.action==="respond_upgrade")await respondRoomUpgrade(DB,{roomId:id,userId:user.id,proposalId:data.proposalId,response:data.response,now});
  else if(data.action==="add_module_entry")result=await addRoomModuleEntry(DB,{roomId:id,userId:user.id,moduleId:data.moduleId,payload:data.payload,now});
  else if(data.action==="update_module_entry")await updateRoomModuleEntry(DB,{roomId:id,userId:user.id,moduleId:data.moduleId,entryId:data.entryId,payload:data.payload,now});
  else if(data.action==="delete_module_entry")await deleteRoomModuleEntry(DB,{roomId:id,userId:user.id,moduleId:data.moduleId,entryId:data.entryId,now});
  else if(data.action==="propose_meeting")result=await proposeMeeting(DB,{roomId:id,userId:user.id,clientRequestId:data.clientRequestId,startsAt:data.startsAt,endsAt:data.endsAt,timezone:data.timezone,note:data.note,parentProposalId:data.parentProposalId,now});
  else if(data.action==="respond_meeting")await respondMeeting(DB,{roomId:id,userId:user.id,proposalId:data.proposalId,response:data.response,now});
  else if(data.action==="save_availability")result=await saveAvailabilityWindow(DB,{roomId:id,userId:user.id,clientWindowId:data.clientWindowId,startsAt:data.startsAt,endsAt:data.endsAt,timezone:data.timezone,now});
  else await withdrawAvailabilityWindow(DB,{roomId:id,userId:user.id,windowId:data.windowId,now});
  return Response.json(result,{headers:{"cache-control":"private, no-store"}});
}catch(error){const code=error instanceof Error?error.message:"update_failed";return Response.json({error:code},{status:code.includes("not_found")?404:409})}}
