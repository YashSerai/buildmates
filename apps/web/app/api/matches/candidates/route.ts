import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listCandidateRows, saveCandidateBatch } from "@/src/matching/service";

export async function GET(request:Request){const user=await requireApiUser();if(user instanceof Response)return user;const {DB}=await getPlatformBindings();const now=Date.now();const requested=Number(new URL(request.url).searchParams.get("limit")??30);const candidates=await listCandidateRows(DB,user.id,now,requested);const batchId=await saveCandidateBatch(DB,user.id,candidates,now);return Response.json({batchId,candidates},{headers:{"cache-control":"private, no-store"}})}
