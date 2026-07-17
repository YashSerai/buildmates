"use client";

import Link from "next/link";
import { ProductHeader } from "../components/discovery/ProductHeader";
import styles from "./status.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className={styles.page}>
    <ProductHeader />
    <section className={styles.state} role="alert">
      <p className={styles.eyebrow}>The trail broke here</p>
      <h1>This view could not load.</h1>
      <p>Try this page again, or return home and continue from there.</p>
      <div className={styles.actions}><button type="button" onClick={reset}>Try again</button><Link href="/">Return home</Link></div>
    </section>
  </main>;
}
