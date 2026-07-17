import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";

export const metadata: Metadata = { title: "Support", description: "Get help with Buildmates." };

export default async function SupportPage() {
  const user = await getCurrentUser();
  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(user)} />
    <article className={styles.article}>
      <h1>Get Buildmates unstuck.</h1>
      <p className={styles.lead}>Start with the setup guide. If something still fails, send the exact step, what Codex reported, and whether you used the beta plugin or direct MCP.</p>
      <section><h2>Setup help</h2><div><p>The guide covers plugin installation, direct MCP, account authorization, privacy review, and the complete first run.</p><Link className={styles.action} href="/install">Open the setup guide</Link></div></section>
      <section><h2>Report a problem</h2><div><p>Open a GitHub issue for reproducible product or integration bugs. Do not include passwords, access tokens, private prompts, private repository contents, or personal Work Signals.</p><a className={styles.action} href="https://github.com/YashSerai/buildmates/issues" target="_blank" rel="noreferrer">Open GitHub issues</a></div></section>
      <section><h2>Privacy and safety</h2><div><p>Use the in-product report and block controls for another member, message, room, or published page. Account export, connector policies, disconnection, and deletion are available in privacy settings.</p><Link href="/privacy">Read the privacy policy</Link></div></section>
    </article>
    <ProductFooter />
  </main>;
}
