import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "../../../src/auth/require-user";
import styles from "./authorize.module.css";
import { McpAuthorizeButton } from "./McpAuthorizeButton";

export const metadata: Metadata = {
  title: "Connect Codex",
  description: "Connect Codex to your Buildmates account.",
  robots: { index: false, follow: false },
};

export default async function McpAuthorizePage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  const returnTo = query.return_to ?? "";
  const signInReturn = `/mcp/authorize?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Buildmates home">
          <Image aria-hidden="true" src="/brand/buildmates-mark.svg" alt="" width={40} height={32} />
          <strong>buildmates</strong>
        </Link>
        <span className={styles.secure}><i aria-hidden="true" /> Secure account connection</span>
      </header>

      <div className={styles.stage}>
        <section className={styles.consent} aria-labelledby="authorize-title">
          <div className={styles.connectionView} aria-label="Codex connecting to Buildmates">
            <p className={styles.connectionLabel}>Connection request</p>
            <div className={styles.connectionRoute} aria-hidden="true">
              <div className={styles.endpoint}>
                <span className={styles.codexMark}><Image src="/brand/codex-app-cropped.png" alt="" width={44} height={44} unoptimized /></span>
                <span><strong>Codex</strong><small>Your current task</small></span>
              </div>
              <div className={styles.bridge}>
                <span><i /><i /><i /></span>
                <small>secure handoff</small>
              </div>
              <div className={styles.endpoint}>
                <span className={styles.buildmatesMark}><Image src="/brand/buildmates-mark-reversed.svg" alt="" width={52} height={44} /></span>
                <span><strong>Buildmates</strong><small>Your builder network</small></span>
              </div>
            </div>
            <p className={styles.connectionNote}>Your GitHub sign-in confirms who you are. It does not give Buildmates access to your repositories.</p>
          </div>

          <div className={styles.content}>
            <p className={styles.kicker}>Codex connection</p>
            <h1 id="authorize-title">Let Codex work with your Buildmates account.</h1>
            <p className={styles.lead}>Use Buildmates from Codex while keeping control of what gets read, changed, and shared.</p>

            <div className={styles.permissions} aria-label="What Codex can do">
              <div><span>01</span><p><strong>Continue your setup</strong><small>Read your profile, preferences, matches, connections, and rooms when you ask.</small></p></div>
              <div><span>02</span><p><strong>Save approved changes</strong><small>Create or update Buildmates information through actions you confirm or automations you enable.</small></p></div>
              <div><span>03</span><p><strong>Keep source accounts separate</strong><small>Buildmates never receives connected-app credentials or raw source content through this connection.</small></p></div>
            </div>

            {user && returnTo ? (
              <McpAuthorizeButton returnTo={returnTo} />
            ) : !returnTo ? (
              <div className={styles.unavailable} role="alert">
                <strong>This connection link has expired.</strong>
                <span>Return to Codex and start the Buildmates connection again.</span>
              </div>
            ) : (
              <div className={styles.signInBlock}>
                <Link className={styles.signIn} href={`/api/auth/github/start?return_to=${encodeURIComponent(signInReturn)}`}>Continue with GitHub</Link>
                <span>Sign in first, then you can approve this connection.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
