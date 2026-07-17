import type { Metadata } from "next";
import Link from "next/link";
import {
  ProductFooter,
  ProductHeader,
} from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";
import { CodexInstallActions } from "./CodexInstallActions";

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
        <h1>Let Codex set it up.</h1>
        <p className={styles.lead}>
          Open the official Buildmates app, give Codex the prompt below, and it
          will guide you from an empty account to a profile you have reviewed.
        </p>
        <section>
          <h2>Start here</h2>
          <div>
            <p>
              The prompt includes this page, so Codex has the official setup
              instructions even if it has never heard of Buildmates.
            </p>
            <CodexInstallActions />
          </div>
        </section>
        <section>
          <h2>What Codex will do</h2>
          <div>
            <ol className={styles.steps}>
              <li>Connect the official Buildmates app to your account.</li>
              <li>Choose what Codex may use to understand your work.</li>
              <li>Review what belongs on your profile.</li>
              <li>Preview the page Codex creates for you.</li>
              <li>
                Choose who you want to meet and how often Buildmates should
                look.
              </li>
            </ol>
            <p>
              You can start with connected apps, a project or portfolio link,
              or a short description. If context is sparse, Codex asks focused
              questions. Nothing is shared with Buildmates until you approve
              the summary.
            </p>
            <Link className={styles.secondary} href="/onboarding">
              {user ? "Use manual setup instead" : "Set up on the website instead"}
            </Link>
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
