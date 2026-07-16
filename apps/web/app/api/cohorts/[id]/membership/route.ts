import { isAuthResponse,requireApiUser } from "../../../../../src/auth/require-user";
import { leaveCohort,requestCohortMembership } from "../../../../../src/discovery/service";
import { getPlatformBindings } from "../../../../../src/platform/bindings";
import { requireSameOriginMutation } from "../../../../../src/platform/same-origin";
async function run(request:Request,params:Promise<{id:string}>,leave=false){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(isAuthResponse(user))return user;try{const{id}=await params;const{DB}=await getPlatformBindings();return Response.json(leave?await leaveCohort(DB,user.id,id):await requestCohortMembership(DB,user.id,id))}catch(error){const message=error instanceof Error?error.message:"membership_failed";return Response.json({error:message},{status:message==="forbidden"?403:400})}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return run(request,params)}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){return run(request,params,true)}
