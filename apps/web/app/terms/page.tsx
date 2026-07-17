import type { Metadata } from "next";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";

export const metadata: Metadata = { title: "Terms", description: "Terms for using Buildmates." };

export default async function TermsPage() {
  const user = await getCurrentUser();
  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(user)} />
    <article className={styles.article}>
      <h1>Build together. Act responsibly.</h1>
      <p className={styles.lead}>These terms apply when you use the Buildmates website, plugin, MCP tools, profiles, introductions, rooms, and Circles.</p>
      <section><h2>Your account</h2><div><p>Provide accurate information, protect access to your account, and use Buildmates only where you are legally permitted to do so. You are responsible for what you publish and the actions you approve.</p></div></section>
      <section><h2>Respect other builders</h2><div><p>Do not harass, impersonate, scrape, spam, exploit, or use Buildmates to obtain information you are not authorized to access. Do not upload malicious code or try to bypass privacy, matching, room, or moderation controls.</p></div></section>
      <section><h2>Your content</h2><div><p>You keep ownership of your content. You give Buildmates permission to store, process, and display it only as needed to provide the service and according to the visibility choices you make. You may export or delete your account from the product.</p></div></section>
      <section><h2>Availability</h2><div><p>Buildmates is provided as available and may change as the product develops. We may limit or suspend access when necessary for security, abuse prevention, legal compliance, or service reliability.</p><p>Effective July 17, 2026.</p></div></section>
    </article>
    <ProductFooter />
  </main>;
}
