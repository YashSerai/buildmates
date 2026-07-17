import { isAuthResponse,requireApiUser } from "../../../src/auth/require-user";
import { setFollow } from "../../../src/discovery/service";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { requireSameOriginMutation } from "../../../src/platform/same-origin";
const kinds=new Set(["profile","project","topic"]);
export async function POST(request:Request){const origin=requireSameOriginMutation(request);if(origin)return origin;const user=await requireApiUser();if(isAuthResponse(user))return user;try{const body=await request.json() as {targetKind:string;targetId:string;enabled:boolean};if(!kinds.has(body.targetKind)||typeof body.enabled!=="boolean")throw new Error("invalid_request");const{DB}=await getPlatformBindings();return Response.json(await setFollow(DB,user.id,body.targetKind as "profile"|"project"|"topic",body.targetId,body.enabled))}catch(error){const message=error instanceof Error?error.message:"follow_failed";return Response.json({error:message},{status:message==="rate_limited"?429:400})}}
