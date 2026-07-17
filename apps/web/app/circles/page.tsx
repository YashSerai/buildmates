import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listCircles, listCircleSuggestions } from "@/src/circles/service";
import { CirclesClient } from "./CirclesClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./circles.module.css";

export const metadata: Metadata = { title: "Circles | Buildmates", description: "Small builder groups formed from relevant connections.", robots: { index: false, follow: false } };

export default async function CirclesPage() {
  const user = await requireUser("/circles");
  const { DB } = await getPlatformBindings();
  const [circles, suggestions] = await Promise.all([listCircles(DB, user.id), listCircleSuggestions(DB, user.id)]);
  return <><ProductHeader signedIn/><main className={styles.page}>
    <section className={styles.intro}><p>Build together</p><h1>Bring related Connections into one room.</h1><span>Start a small group with a clear purpose. Chat stays simple, and trackers, resources, or scoreboards appear only after the Circle&apos;s approval process.</span></section>
    <CirclesClient initialCircles={circles} initialSuggestions={suggestions} />
  </main></>;
}
