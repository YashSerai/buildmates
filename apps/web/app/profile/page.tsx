import { redirect } from "next/navigation";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";

export default async function MyProfilePage() {
  const [user, { DB }] = await Promise.all([requireUser("/profile"), getPlatformBindings()]);
  const profile = await DB.prepare(`SELECT handle.handle,surface.published_revision_id AS publishedRevisionId
    FROM profiles profile
    LEFT JOIN handles handle ON handle.user_id=profile.user_id
    LEFT JOIN surfaces surface ON surface.kind='profile' AND surface.subject_id=profile.id
    WHERE profile.user_id=? LIMIT 1`).bind(user.id).first<{ handle: string | null; publishedRevisionId: string | null }>();
  if (profile?.handle && profile.publishedRevisionId) redirect(`/builders/${encodeURIComponent(profile.handle)}`);
  if (profile?.handle) redirect("/profile/design");
  redirect("/profile/edit");
}
