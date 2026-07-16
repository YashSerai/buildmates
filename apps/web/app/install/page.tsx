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
      <p className={styles.lead}>Connect Buildmates in Codex, link your website identity, and finish with a reviewed profile, source permissions, Networking Pulse, and automation choice.</p>
      <section><h2>Before you start</h2><div><p>Buildmates works with apps already available in your conversation. You choose access one installed app at a time. Existing connector permissions and action confirmations remain in force.</p></div></section>
      <section><h2>First run</h2><div><ol className={styles.steps}><li>Sign in to the Buildmates website and create a one-time linking code.</li><li>Connect the Buildmates app in Codex and submit that code.</li><li>Let Codex inspect only the connected apps you select.</li><li>Review or reject every proposed Work Signal.</li><li>Publish your profile and choose Manual or Full Autopilot matching.</li></ol><p>If Codex has too little context, it asks focused questions or lets you add a repository, portfolio link, or short project description.</p><Link className={styles.action} href={user ? "/settings/connections" : "/account"}>{user ? "Link Codex" : "Sign in first"}</Link><Link className={styles.secondary} href="/onboarding">Open onboarding</Link></div></section>
    </article>
    <ProductFooter />
  </main>;
}
