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
        <h1>Give Codex one link.</h1>
        <p className={styles.lead}>
          Codex connects Buildmates, then guides you through a profile and
          networking preferences you have reviewed.
        </p>
        <section>
          <h2>Start in Codex</h2>
          <div>
            <p>
              Copy one short prompt into a new Codex task. This page carries the
              setup instructions, so the prompt does not have to.
            </p>
            <CodexInstallActions />
          </div>
        </section>
        <section>
          <h2>What happens next</h2>
          <div>
            <ol className={styles.steps}>
              <li>Codex asks you to install Buildmates inside Codex, then checks your account.</li>
              <li>You choose what Codex may use to understand your work.</li>
              <li>You review your profile and the page Codex creates.</li>
              <li>
                You choose who to meet and how often Buildmates should
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
        <section>
          <h2>The setup rule</h2>
          <div className={styles.status}>
            <p>
              <strong>Buildmates installs inside Codex.</strong>{" "}Codex asks for
              your confirmation there. It does not drive Chrome through the
              ChatGPT website.
            </p>
            <p>
              GitHub opens only to establish your Buildmates website identity.
              You can complete it yourself or ask Codex for guided browser help.
            </p>
            <p>
              <strong>Your account decides where setup resumes.</strong>{" "}An
              earlier Buildmates conversation does not.
            </p>
            <p className={styles.mono}>
              Codex: connect the official app, call get_setup_state, and trust
              only its completed count and nextStep. Then follow the Buildmates
              onboarding workflow one step at a time.
            </p>
            <Link href="/llms.txt">Read the full agent instructions</Link>
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
