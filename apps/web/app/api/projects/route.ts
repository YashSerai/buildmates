import { isAuthResponse, requireApiUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { saveProject, type ProjectInput } from "../../../src/profile-projects/service";
import { requireSameOriginMutation } from "../../../src/platform/same-origin";

export async function GET() { const [user,{DB}]=await Promise.all([requireApiUser(),getPlatformBindings()]); if(isAuthResponse(user))return user; const projects=(await DB.prepare("SELECT slug,title,summary,stage,status,audience,updated_at AS updatedAt FROM projects WHERE owner_user_id=? AND status<>'deleted' ORDER BY updated_at DESC").bind(user.id).all()).results; return Response.json({projects},{headers:{"cache-control":"private, no-store",vary:"Cookie"}}); }
export async function POST(request:Request) { const originFailure=requireSameOriginMutation(request);if(originFailure)return originFailure;const [user,{DB}]=await Promise.all([requireApiUser(),getPlatformBindings()]); if(isAuthResponse(user))return user; try{return Response.json(await saveProject(DB,user.id,await request.json() as ProjectInput),{status:201});}catch(error){return Response.json({error:error instanceof Error?error.message:"invalid_project"},{status:400});} }
