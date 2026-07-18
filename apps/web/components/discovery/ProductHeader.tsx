import Link from "next/link";
import styles from "./product-shell.module.css";
import polish from "./product-shell-polish.module.css";
import { ProductNavLinks, type ProductNavItem } from "./ProductNav";

const signedInPrimary: ProductNavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/matches", label: "Introductions" },
  { href: "/connections", label: "Connections" },
  { href: "/circles", label: "Circles" },
  { href: "/inbox", label: "Activity" },
];

const signedInMenu: ProductNavItem[] = [
  { href: "/profile", label: "Profile" },
  { href: "/invite", label: "Invite" },
  { href: "/settings/privacy", label: "Settings" },
  { href: "/map", label: "Map" },
  { href: "/graph", label: "Build graph" },
];

export function ProductHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header
      className={`${styles.header} ${signedIn ? polish.signedInHeader : ""}`}
      data-auth={signedIn ? "signed-in" : "signed-out"}
    >
      <Link className={styles.wordmark} href="/" aria-label="Buildmates home">
        <span aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <strong>buildmates</strong>
      </Link>
      <nav
        className={`${styles.primaryNav} ${polish.primaryNavPolish}`}
        aria-label={signedIn ? "Your Buildmates" : "Primary navigation"}
      >
        {signedIn ? (
          <ProductNavLinks items={signedInPrimary} />
        ) : (
          <>
            <Link href="/map">Map</Link>
            <Link href="/graph">Build graph</Link>
          </>
        )}
      </nav>
      {signedIn ? (
        <details
          className={`${styles.accountMenu} ${polish.accountMenuPolish}`}
        >
          <summary>Menu</summary>
          <nav aria-label="Account menu">
            <span className={styles.mobileMenuLinks}>
              <ProductNavLinks items={signedInPrimary} />
            </span>
            <ProductNavLinks items={signedInMenu} />
          </nav>
        </details>
      ) : (
        <Link className={styles.account} href="/account">
          Sign in
        </Link>
      )}
    </header>
  );
}

export function ProductFooter() {
  return (
    <footer className={styles.footer}>
      <p>
        <strong>buildmates</strong>
        <br />
        Meet through the work, interests, and ambitions you share.
      </p>
      <nav aria-label="Footer">
        <Link href="/product">How it works</Link>
        <Link href="/map">Map</Link>
        <Link href="/graph">Build graph</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
        <Link href="/install">Install</Link>
      </nav>
      <small>your work changes. your network keeps up.</small>
    </footer>
  );
}
