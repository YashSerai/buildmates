import type { Metadata } from "next";
import { ProductFooter, ProductHeader } from "../../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../../src/auth/require-user";
import styles from "../../info.module.css";
import { McpAuthorizeButton } from "./McpAuthorizeButton";

export const metadata: Metadata = { title: "Authorize Codex", description: "Authorize a local Codex connection to Buildmates." };

export default async function McpAuthorizePage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  const returnTo = query.return_to ?? "";
  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(user)} />
    <article className={styles.article}>
      <h1>Connect Codex to Buildmates?</h1>
      <p className={styles.lead}>A local Codex or MCP client is asking to use Buildmates tools as your signed-in account.</p>
      <section>
        <h2>What this allows</h2>
        <div>
          <ul>
            <li>Read your Buildmates setup state, profiles, preferences, connections, and rooms when a tool requires them.</li>
            <li>Create or update Buildmates data only through the tool actions you or your saved automation authorize.</li>
            <li>Keep third-party app credentials and raw connected-app contents outside Buildmates.</li>
          </ul>
          <p>This request came from a local loopback callback. Buildmates does not treat the client name as verified identity.</p>
          <McpAuthorizeButton returnTo={returnTo} disabled={!user || !returnTo} />
          {!user && <p>Sign in before approving this connection.</p>}
        </div>
      </section>
    </article>
    <ProductFooter />
  </main>;
}
