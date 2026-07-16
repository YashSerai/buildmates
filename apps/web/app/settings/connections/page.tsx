import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getIdentityConnectionStatus } from "@/src/platform/identity-connections";
import { ConnectionsClient } from "./ConnectionsClient";
import { SignOutButton } from "@/components/auth/SignOutButton";
import styles from "./connections.module.css";

export const metadata: Metadata = {
  title: "Connect Codex | Buildmates",
  description: "Securely link your Buildmates web account to Buildmates in Codex.",
  robots: { index: false, follow: false },
};

export default async function ConnectionsPage() {
  const user = await requireUser("/settings/connections");
  const { DB } = await getPlatformBindings();
  const initialStatus = await getIdentityConnectionStatus(
    DB,
    user.id,
    user.identity.workspaceScope,
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/" aria-label="Buildmates home">
          Buildmates
        </a>
        <div className={styles.account}>
          <span className={styles.accountName}>
            {user.identity.displayName ?? "Signed in with GitHub"}
          </span>
          <SignOutButton className={styles.signOut} />
        </div>
      </header>

      <section className={styles.intro} aria-labelledby="connections-title">
        <p className={styles.sectionName}>Account connection</p>
        <h1 id="connections-title">Connect Buildmates to Codex</h1>
        <p className={styles.lede}>
          Approve a private link between this account and the Buildmates plugin in
          your Codex conversation. Your connected-app credentials stay with Codex.
        </p>
      </section>

      <ConnectionsClient initialStatus={initialStatus} />

      <aside className={styles.boundary} aria-labelledby="privacy-boundary-title">
        <h2 id="privacy-boundary-title">What this approves</h2>
        <p>
          The link lets the Buildmates plugin act as this Buildmates account. It
          does not grant Buildmates access to your raw chats, prompts, repositories,
          calendar, email, or connector credentials.
        </p>
      </aside>
    </main>
  );
}
