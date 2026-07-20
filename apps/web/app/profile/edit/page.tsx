import Link from "next/link";
import { ProfileReview } from "../../../components/profile-projects/ProfileReview";
import { requireUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { getProfileByHandle } from "../../../src/profile-projects/service";
import styles from "../../profile-projects.module.css";
import { ProductHeader } from "../../../components/discovery/ProductHeader";

export default async function ProfileEditPage() {
  const user = await requireUser("/profile/edit");
  const { DB } = await getPlatformBindings();
  const handle = await DB.prepare("SELECT handle FROM handles WHERE user_id=? LIMIT 1").bind(user.id).first<{ handle: string }>();
  const profile = handle ? await getProfileByHandle(DB, handle.handle, user.id) : null;

  return <><ProductHeader signedIn/><main className={styles.profileShell}>
    <div className={styles.profileActions}><Link href={handle ? `/builders/${handle.handle}` : "/home"}>Back to profile</Link><Link href="/profile/design">Edit design</Link></div>
    <ProfileReview
      defaultHandle={handle?.handle ?? ""}
      initial={profile ? {
        displayName: profile.displayName,
        summary: profile.summary,
        acceptanceMode: profile.acceptanceMode,
        coarseLocation: profile.coarseLocation ?? "",
        allowMatching: profile.allowMatching,
        locationMapOptIn: profile.locationMapOptIn,
        fields: profile.fields,
        statistics: profile.statistics,
      } : undefined}
    />
  </main></>;
}
