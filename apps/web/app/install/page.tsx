import type { Metadata } from "next";
import Link from "next/link";
import {
  ProductFooter,
  ProductHeader,
} from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";

export const metadata: Metadata = {
  title: "Install",
  description: "Connect Buildmates in Codex and complete the guided first run.",
};

export default async function InstallPage() {
  const user = await getCurrentUser();
  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(user)} />
      <article className={styles.article}>
        <h1>Start in Codex.</h1>
        <p className={styles.lead}>
          Install Buildmates, answer a few questions, then review the profile
          and page Codex makes for you.
        </p>
        <section>
          <h2>Bring your own context</h2>
          <div>
            <p>
              You can start with the apps already connected to Codex, a project
              link, a portfolio, or a short description. You decide what
              Buildmates may use.
            </p>
          </div>
        </section>
        <section>
          <h2>Your first run</h2>
          <div>
            <ol className={styles.steps}>
              <li>Connect Buildmates to your account.</li>
              <li>Choose what Codex may use to understand your work.</li>
              <li>Review what belongs on your profile.</li>
              <li>Preview the page Codex creates for you.</li>
              <li>
                Choose who you want to meet and how often Buildmates should
                look.
              </li>
            </ol>
            <p>
              If there is not enough context yet, Codex asks a few focused
              questions and improves the profile over time.
            </p>
            <Link
              className={styles.action}
              href={user ? "/settings/connections" : "/account"}
            >
              {user ? "Connect Codex" : "Sign in first"}
            </Link>
            <Link className={styles.secondary} href="/onboarding">
              Start setup
            </Link>
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
