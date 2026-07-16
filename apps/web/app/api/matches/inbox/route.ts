import { requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listMatchInbox } from "@/src/matching/service";
export async function GET(){const user=await requireApiUser();if(user instanceof Response)return user;const {DB}=await getPlatformBindings();return Response.json({proposals:await listMatchInbox(DB,user.id,Date.now())},{headers:{"cache-control":"private, no-store"}})}
