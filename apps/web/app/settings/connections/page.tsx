import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getIdentityConnectionStatus } from "@/src/platform/identity-connections";
import { ConnectionsClient } from "./ConnectionsClient";
import { SettingsShell } from "@/components/settings/SettingsShell";
import styles from "./connections.module.css";

export const metadata: Metadata = {
  title: "Connect Codex",
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
    <SettingsShell
      current="connections"
      eyebrow="Codex connection"
      title="Connect Buildmates to Codex"
      description="Approve a private link between this account and Buildmates in your Codex conversation. Your connected-app credentials stay with Codex."
    >
      <div className={styles.connectionContent}>
        <ConnectionsClient initialStatus={initialStatus} />

        <aside className={styles.boundary} aria-labelledby="privacy-boundary-title">
          <h2 id="privacy-boundary-title">What this approves</h2>
          <p>
            The link lets Buildmates in Codex act as this Buildmates account. It
            does not grant Buildmates access to your raw chats, prompts, repositories,
            calendar, email, or connector credentials.
          </p>
        </aside>
      </div>
    </SettingsShell>
  );
}
