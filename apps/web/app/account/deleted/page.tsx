import type { Metadata } from "next";
import Link from "next/link";
import { ProductHeader } from "../../../components/discovery/ProductHeader";
import styles from "../../info.module.css";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false, follow: false } };

export default function AccountDeletedPage() {
  return <main className={styles.page}>
    <ProductHeader />
    <article className={styles.article}>
      <h1>Your Buildmates account is deleted.</h1>
      <p className={styles.lead}>Your access has been revoked and deletion has begun. Buildmates keeps only the limited, content-free safety and integrity records described in the privacy policy.</p>
      <Link className={styles.action} href="/">Return to Buildmates</Link>
      <Link className={styles.secondary} href="/privacy">Review the privacy model</Link>
    </article>
  </main>;
}
