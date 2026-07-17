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
              <li>Codex installs the public plugin, the GitHub beta, or the direct MCP connection, then checks your account.</li>
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
          <h2>Testing before publication</h2>
          <div>
            <p>
              The GitHub beta is the complete Buildmates plugin: onboarding
              skills plus the production MCP connection. Codex adds the
              Buildmates repository marketplace, asks you to install it, then
              opens a browser once so you can authorize your account.
            </p>
            <p>
              Direct MCP is the smaller fallback. It connects the same
              production tools without installing the Buildmates skills. The
              setup guide remains the workflow authority in that mode.
            </p>
            <p className={styles.mono}>
              Repository: github.com/YashSerai/buildmates<br />
              MCP: buildmates-mcp.yashserai1.workers.dev/mcp
            </p>
          </div>
        </section>
        <section>
          <h2>The setup rule</h2>
          <div className={styles.status}>
            <p>
              <strong>Buildmates connects inside Codex.</strong>{" "}Codex asks for
              confirmation before installing the beta plugin or adding the MCP
              server. A browser opens only for account authorization.
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
              only its completed count and nextStep. Present up to three fully
              described actions, ask once for that batch, and preserve the
              separate consent checkpoints in the agent instructions.
            </p>
            <Link href="/llms.txt">Read the full agent instructions</Link>
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
