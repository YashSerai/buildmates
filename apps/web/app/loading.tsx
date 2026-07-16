import { ProductHeader } from "../components/discovery/ProductHeader";
import styles from "./status.module.css";

export default function Loading() {
  return <main className={styles.page} aria-busy="true" aria-live="polite">
    <ProductHeader />
    <section className={styles.state}>
      <p className={styles.eyebrow}>Following the work trail</p>
      <h1>Loading Buildmates…</h1>
      <div className={styles.track} aria-hidden="true"><span /></div>
    </section>
  </main>;
}
