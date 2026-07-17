import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import {
  listCandidateRows,
  listMatchInbox,
  serverTimestamp,
} from "@/src/matching/service";
import { MatchesClient } from "./MatchesClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./matches.module.css";
export const metadata: Metadata = {
  title: "Matches",
  description: "Review relevant builders and reciprocal introductions.",
  robots: { index: false, follow: false },
};
export default async function MatchesPage() {
  const user = await requireUser("/matches");
  const { DB } = await getPlatformBindings();
  const now = await serverTimestamp();
  const [candidates, proposals] = await Promise.all([
    listCandidateRows(DB, user.id, now, 30),
    listMatchInbox(DB, user.id, now),
  ]);
  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.page}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>For you</p>
          <h1>People worth meeting now.</h1>
          <p>
            These introductions are based on the work, interests, ambitions, and
            preferences you chose to share.
          </p>
        </section>
        <MatchesClient
          initialCandidates={candidates}
          initialProposals={proposals}
        />
      </main>
    </>
  );
}
