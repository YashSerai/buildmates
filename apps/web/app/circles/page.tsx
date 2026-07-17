import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listCircles, listCircleSuggestions } from "@/src/circles/service";
import { CirclesClient } from "./CirclesClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./circles.module.css";

export const metadata: Metadata = {
  title: "Circles",
  description: "Small builder groups formed from relevant connections.",
  robots: { index: false, follow: false },
};

export default async function CirclesPage() {
  const user = await requireUser("/circles");
  const { DB } = await getPlatformBindings();
  const [circles, suggestions] = await Promise.all([
    listCircles(DB, user.id),
    listCircleSuggestions(DB, user.id),
  ]);
  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.page}>
        <section className={styles.intro}>
          <p>Build together</p>
          <h1>Bring related connections into one room.</h1>
          <span>
            Start with a simple group chat, then add shared tools when everyone
            wants them.
          </span>
        </section>
        <CirclesClient
          initialCircles={circles}
          initialSuggestions={suggestions}
        />
      </main>
    </>
  );
}
