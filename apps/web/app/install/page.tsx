import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";

export const metadata: Metadata = { title: "Install", description: "Connect Buildmates in Codex and complete the guided first run." };

export default async function InstallPage() {
  const user = await getCurrentUser();
  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(user)} />
    <article className={styles.article}>
      <h1>One app. A clear first run.</h1>
      <p className={styles.lead}>Connect Buildmates in Codex, link your website account, and finish with a reviewed profile, source permissions, Networking Pulse, and automation choice.</p>
      <section><h2>Before you start</h2><div><p>Buildmates can use apps already available in the current conversation. Codex presents the sources it can identify, and you confirm each one separately. Existing connector permissions and action confirmations still apply.</p></div></section>
      <section><h2>First run</h2><div><ol className={styles.steps}><li>Sign in to the Buildmates website and create a one-time linking code.</li><li>Connect Buildmates in Codex and submit that code.</li><li>Choose which identified sources Buildmates may use.</li><li>Review or reject every proposed Work Signal.</li><li>Review your profile, set a Networking Pulse, and choose Manual or Full Autopilot acceptance.</li></ol><p>If Codex has too little context, it asks focused questions or lets you add one repository or project, portfolio links, or a short description.</p><Link className={styles.action} href={user ? "/settings/connections" : "/account"}>{user ? "Link Codex" : "Sign in first"}</Link><Link className={styles.secondary} href="/onboarding">Open onboarding</Link></div></section>
    </article>
    <ProductFooter />
  </main>;
}
