import type { Metadata } from "next";
import { requireAppealIdentity } from "@/src/platform/identity";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listAppealableOutcomes } from "@/src/moderation/service";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AppealClient } from "./AppealClient";
import styles from "../../info.module.css";

export const metadata: Metadata = { title: "Safety outcome", robots: { index: false, follow: false } };

export default async function AppealPage() {
  const identity = await requireAppealIdentity("/account/appeal");
  const { DB } = await getPlatformBindings();
  const outcomes = await listAppealableOutcomes(DB, identity.userId);
  return <main className={styles.page}><article className={styles.article}>
    <h1>{identity.accountStatus === "suspended" ? "Your Buildmates account is suspended." : "Review a safety outcome."}</h1>
    <p className={styles.lead}>{identity.accountStatus === "suspended" ? "Normal account access is disabled. This limited page can only show safety outcomes and submit an appeal." : "You can ask Buildmates to review an eligible safety outcome again."}</p>
    <AppealClient initialOutcomes={outcomes} />
    <SignOutButton className={styles.secondary} />
  </article></main>;
}
