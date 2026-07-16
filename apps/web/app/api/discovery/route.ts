import { getCurrentUser } from "../../../src/auth/require-user";
import { listDiscovery, type DiscoveryOptions } from "../../../src/discovery/service";
import { getPlatformBindings } from "../../../src/platform/bindings";

export async function GET(request:Request){
  const url=new URL(request.url);
  const [viewer,{DB}]=await Promise.all([getCurrentUser(),getPlatformBindings()]);
  const keys=(['query','location','timezone','stage','topic','tool','problem','offer','need','cohort','collaboration'] as const);
  const options:DiscoveryOptions={};
  for(const key of keys){const queryKey=key==='query'?'q':key;const value=url.searchParams.get(queryKey);if(value)options[key]=value}
  const limit=Number(url.searchParams.get('limit'));if(Number.isFinite(limit))options.limit=limit;
  return Response.json(await listDiscovery(DB,viewer?.id??null,options),{headers:{'cache-control':viewer?'private, no-store':'public, max-age=30'}});
}
