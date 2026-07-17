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
            <h2>Your connections will live here.</h2>
            <p>
              New connections appear after an introduction. You can return to
              the room, add a note, or reconnect later.
            </p>
            <a href="/matches">See recommendations</a>
          </section>
        )}
      </main>
    </>
  );
}
