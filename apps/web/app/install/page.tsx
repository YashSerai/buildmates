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
              Copy one short prompt into a new Codex task. Codex reads the
              current instructions and handles the connection from there.
            </p>
            <CodexInstallActions />
          </div>
        </section>
        <section>
          <h2>What happens next</h2>
          <div>
            <ol className={styles.steps}>
              <li>Codex connects Buildmates and checks whether you are starting fresh or returning.</li>
              <li>You choose what Codex may use to understand your work.</li>
              <li>You review your profile and the page Codex creates.</li>
              <li>
                You choose who to meet and how often Buildmates should
                look.
              </li>
            </ol>
            <p>
              Start with what Codex already knows in this task, add a connected
              app that is actually available, or tell Codex directly with a
              project, portfolio link, or short description. You can combine
              all three. Nothing is shared with Buildmates until you approve
              the summary.
            </p>
            <p>
              Routine setup actions come in short batches of up to three. You
              see what each action uses and changes, then approve the batch once.
              Codex pauses again when there is something new to review.
            </p>
            <Link className={styles.secondary} href="/onboarding">
              {user ? "Use manual setup instead" : "Set up on the website instead"}
            </Link>
          </div>
        </section>
        <section>
          <h2>What opens in your browser</h2>
          <div>
            <p>
              Codex handles the Buildmates connection inside Codex. Your
              browser opens only when Buildmates needs you to sign in or approve
              account access.
            </p>
            <p>
              Codex will not type credentials, retrieve verification codes, or
              approve consent for you. You stay in control of those steps.
            </p>
          </div>
        </section>
        <section>
          <h2>Continue where you left off</h2>
          <div>
            <p>
              Buildmates checks your account before asking questions. A new
              Codex task can continue an unfinished setup without relying on an
              old conversation.
            </p>
            <p>
              If Codex cannot connect, it explains what needs attention instead
              of pretending setup is complete.
            </p>
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
