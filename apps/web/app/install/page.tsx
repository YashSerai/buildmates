import type { Metadata } from "next";
import Link from "next/link";
import {
  ProductFooter,
  ProductHeader,
} from "../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../src/auth/require-user";
import styles from "../info.module.css";
import { CodexInstallActions, DirectMcpConnection } from "./CodexInstallActions";

export const metadata: Metadata = {
  title: "Connect Buildmates",
  description: "Connect the Buildmates developer preview in ChatGPT or Codex, then complete the guided first run.",
};

export default async function InstallPage() {
  const user = await getCurrentUser();
  return (
    <main className={styles.page}>
      <ProductHeader signedIn={Boolean(user)} />
      <article className={styles.article}>
        <h1>Connect Buildmates to your host.</h1>
        <p className={styles.lead}>
          Install Buildmates in ChatGPT or Codex, then connect your account.
          Buildmates guides you through a reviewed profile, matching
          preferences, and optional collaboration.
        </p>
        <section>
          <h2>Start from ChatGPT or Codex</h2>
          <div>
            <p>
              Use your host&apos;s native developer-preview or plugin-install
              control. Once connected, copy the prompt into a new ChatGPT chat
              or Codex task. A new chat or task may be required before the
              tools appear.
            </p>
            <CodexInstallActions />
          </div>
        </section>
        <section>
          <h2>Developer preview paths</h2>
          <div>
            <p>
              If your host supports direct MCP connections, copy the endpoint
              into its connection field. Your host will guide you through
              sign-in and consent.
            </p>
            <DirectMcpConnection />
            <p className={styles.status}>
              <strong>Developer preview</strong>
              Availability and connection status are shown by your host.
            </p>
          </div>
        </section>
        <section>
          <h2>What happens next</h2>
          <div>
            <ol className={styles.steps}>
              <li>Your host connects Buildmates and checks whether you are starting fresh or returning.</li>
              <li>With your permission, the host reviews only the sources you choose.</li>
              <li>You review your profile and choose whether to create a public page.</li>
              <li>
                You choose who to meet and how often Buildmates should
                look.
              </li>
            </ol>
            <p>
              Choose a specific project, connected source, or direct
              description. Codex can review a named project or workspace scope
              that you approve. ChatGPT can use connected sources, uploads, and
              information you provide in the chat. Buildmates receives only the
              structured profile and summaries you review.
            </p>
            <p>
              Your host explains what it will use before it starts, then pauses
              when your profile or another meaningful decision is ready to
              review. A public page and recurring Work Pulse are optional, so
              you can finish without a public page and use manual refresh.
            </p>
            <Link className={styles.secondary} href="/onboarding/manual">
              {user ? "Use manual setup instead" : "Set up manually on the website"}
            </Link>
          </div>
        </section>
        <section>
          <h2>What opens in your browser</h2>
          <div>
            <p>
              Your host handles the Buildmates connection. A browser opens only
              when Buildmates needs you to sign in or approve account access.
            </p>
          </div>
        </section>
        <section>
          <h2>Continue where you left off</h2>
          <div>
            <p>
              Buildmates checks your account before asking questions. A new
              ChatGPT chat or Codex task can continue an unfinished setup
              without relying on an old conversation.
            </p>
            <p>
              If the current host cannot connect, it explains what needs
              attention instead of pretending setup is complete.
            </p>
          </div>
        </section>
      </article>
      <ProductFooter />
    </main>
  );
}
