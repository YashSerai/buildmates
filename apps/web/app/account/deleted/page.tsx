import type { Metadata } from "next";
import Link from "next/link";
import { ProductHeader } from "../../../components/discovery/ProductHeader";
import styles from "../../info.module.css";

export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
  return (
    <main className={styles.page}>
      <ProductHeader />
      <article className={styles.article}>
        <h1>Your account is being deleted.</h1>
        <p className={styles.lead}>
          You can no longer sign in. Your profile, projects, pages, messages,
          and uploaded files are being removed or anonymized. Buildmates keeps
          only the limited safety records described in the privacy policy.
        </p>
        <Link className={styles.action} href="/">
          Return to Buildmates
        </Link>
        <Link className={styles.secondary} href="/privacy">
          Read the privacy policy
        </Link>
      </article>
    </main>
  );
}
