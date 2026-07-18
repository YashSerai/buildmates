import Link from "next/link";

import {
  ProductFooter,
  ProductHeader,
} from "../components/discovery/ProductHeader";
import { getCurrentUser } from "../src/auth/require-user";
import styles from "./status.module.css";

export default async function NotFoundPage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/home" : "/";
  const primaryLabel = user ? "Open your network" : "Return home";

  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(user)} />
      <section className={styles.state}>
        <p className={styles.eyebrow}>Nothing here yet</p>
        <h1>This page is not in the network.</h1>
        <p>
          The link may be old, private, or no longer available. You can return
          to your network or explore what builders are working on.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link href="/graph">Open the build graph</Link>
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
