import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";

export const metadata: Metadata = { title: "Privacy", description: "The Buildmates data and connected-app privacy model." };

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(user)} />
    <article className={styles.article}>
      <h1>You decide what becomes a signal.</h1>
      <p className={styles.lead}>Codex reads connected sources under the permissions you already granted. Buildmates receives the structured Work Signals permitted by your Buildmates source policies, not the connector credentials or raw source material.</p>
      <section><h2>Source by source</h2><div><ul>
        <li><strong>Never use:</strong> the source stays out of Buildmates workflows.</li>
        <li><strong>Ask each time:</strong> Codex asks before each source read and Work Signal submission.</li>
        <li><strong>Allow approved Work Signals:</strong> an approved Work Pulse may submit concise summaries from that source until you change the policy. Each run reports what changed.</li>
        <li><strong>Actions only:</strong> Codex may perform an approved provider action, but Buildmates cannot extract source context from it.</li>
      </ul><p>These choices control Buildmates workflows only. They do not change ChatGPT, Codex, or provider permissions.</p></div></section>
      <section><h2>Two account boundaries</h2><div><p>GitHub sign-in establishes your Buildmates website account. It does not grant repository access. A separate one-time link connects that account to Buildmates in Codex; disconnecting it stops future Codex syncing without deleting data already stored in Buildmates.</p></div></section>
      <section><h2>Field by field</h2><div><p>Profile fields and projects can be public, signed-in, visible to a suggested connection, visible to a Connection, or private. Work Signals are used only for matching and cannot be published. Permission to use something for matching is separate from permission to display it. Private values are never placed in a public page and hidden with styling.</p></div></section>
      <section><h2>Revocable</h2><div><p>You can revoke sources and signals, pause matching, export your data, disconnect Codex, and delete your account. Deletion revokes access immediately, removes or anonymizes your profile, projects, generated pages, scheduling details, and authored content, and then deletes your uploaded assets. Buildmates keeps only dates, safety outcomes, reason codes, and records needed to prevent abuse; report details and appeal text are removed.</p><p>Custom decorative sections cannot run scripts, submit forms, open popups, control navigation, or load unapproved external content.</p>{user ? <Link className={styles.action} href="/settings/privacy">Open privacy controls</Link> : <Link className={styles.action} href="/account">Sign in to manage privacy</Link>}</div></section>
    </article>
    <ProductFooter />
  </main>;
}
