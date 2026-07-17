import { getPlatformBindings } from "@/src/platform/bindings";
import { completeIdentityLink, createD1IdentityLinkStore } from "@/src/platform/identity-link-store";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { allowLocalTestingRoute } from "@/src/security/testing-route";

export async function POST(request:Request){
  const {DB,BUILDMATES_E2E}=await getPlatformBindings();
  if(!allowLocalTestingRoute(request,BUILDMATES_E2E))return Response.json({error:"not_found"},{status:404});
  const origin=requireSameOriginMutation(request);if(origin)return origin;
  const body=await request.json().catch(()=>null) as {code?:unknown}|null;
  if(typeof body?.code!=="string")return Response.json({error:"invalid_code"},{status:400});
  const result=await completeIdentityLink(createD1IdentityLinkStore(DB),{code:body.code,workspaceScope:"global",mcpSubject:`e2e-${crypto.randomUUID()}`});
  return Response.json(result,{status:result.linked?200:409,headers:{"cache-control":"no-store"}});
}
