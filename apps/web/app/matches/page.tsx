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
  title: "Introductions",
  description: "Review your shortlist and follow reciprocal introductions.",
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
          <div>
            <p className={styles.eyebrow}>Introductions</p>
            <h1>Meet through current work.</h1>
          </div>
          <p>
            Your shortlist changes with the work, interests, and ambitions you
            choose to share. Nothing becomes a connection until both people are
            ready.
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
