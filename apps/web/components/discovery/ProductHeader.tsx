import Link from "next/link";
import styles from "./product-shell.module.css";

export function ProductHeader({ signedIn = false }: { signedIn?: boolean }) {
  return <header className={styles.header}>
    <Link className={styles.wordmark} href="/" aria-label="Buildmates home"><span aria-hidden="true"><i /><i /><i /></span><strong>buildmates</strong></Link>
    <nav aria-label="Primary navigation">
      <Link href="/discover">Discover</Link><Link href="/map">Map</Link><Link href="/graph">Build graph</Link><Link href="/cohorts">Cohorts</Link>
    </nav>
    <Link className={styles.account} href={signedIn ? "/home" : "/account"}>{signedIn ? "Your home" : "Sign in"}</Link>
  </header>;
}

export function ProductFooter() {
  return <footer className={styles.footer}><p><strong>buildmates</strong><br />Meet through the work, interests, and ambitions you share.</p><nav aria-label="Footer"><Link href="/product">How it works</Link><Link href="/privacy">Privacy</Link><Link href="/install">Install</Link></nav><small>work signals in. mutual relevance out.</small></footer>;
}
