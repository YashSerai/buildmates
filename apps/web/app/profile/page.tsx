import { redirect } from "next/navigation";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";

export default async function MyProfilePage() {
  const [user, { DB }] = await Promise.all([requireUser("/profile"), getPlatformBindings()]);
  const profile = await DB.prepare(`SELECT handle.handle,profile.published_at AS publishedAt
    FROM profiles profile LEFT JOIN handles handle ON handle.user_id=profile.user_id
    WHERE profile.user_id=? LIMIT 1`).bind(user.id).first<{ handle: string | null; publishedAt: number | null }>();
  if (profile?.handle && profile.publishedAt) redirect(`/@${encodeURIComponent(profile.handle)}`);
  redirect("/profile/edit");
}
