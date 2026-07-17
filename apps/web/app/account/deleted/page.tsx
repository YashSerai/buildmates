import type { Metadata } from "next";
import Link from "next/link";
import { ProductHeader } from "../../../components/discovery/ProductHeader";
import styles from "../../info.module.css";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false, follow: false } };

export default function AccountDeletedPage() {
  return <main className={styles.page}>
    <ProductHeader />
    <article className={styles.article}>
      <h1>Your Buildmates account is being deleted.</h1>
      <p className={styles.lead}>Access is revoked immediately. Buildmates has removed or anonymized account content and is deleting your uploaded assets. If that deletion needs to resume, the account remains inaccessible while it finishes. Only the limited dates, safety outcomes, and abuse-prevention records described in the privacy policy remain afterward.</p>
      <Link className={styles.action} href="/">Return to Buildmates</Link>
      <Link className={styles.secondary} href="/privacy">Review the privacy model</Link>
    </article>
  </main>;
}
