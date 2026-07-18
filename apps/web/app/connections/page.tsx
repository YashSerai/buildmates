import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listConnections } from "@/src/rooms/service";
import { ConnectionsClient } from "./ConnectionsClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./connections.module.css";
export const metadata: Metadata = {
  title: "Connections",
  description: "People you met through your work.",
  robots: { index: false, follow: false },
};
export default async function ConnectionsPage() {
  const user = await requireUser("/connections");
  const { DB } = await getPlatformBindings();
  const connections = await listConnections(DB, user.id);
  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.page}>
        <section className={styles.intro}>
          <p>Your network</p>
          <h1>People you met through building.</h1>
          <span>
            Return to a room, keep a private note, or reconnect when the timing
            feels right.
          </span>
        </section>
        {connections.length ? (
          <ConnectionsClient initialConnections={connections} />
        ) : (
          <section className={styles.empty}>
            <h2>Your connections will appear here.</h2>
            <p>
              A new Connection appears after an introduction. From there, you
              can return to its room, add a private note, or reconnect later.
            </p>
            <a href="/matches">Open introductions</a>
          </section>
        )}
      </main>
    </>
  );
}
