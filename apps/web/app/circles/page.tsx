import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listCircles, listCircleSuggestions } from "@/src/circles/service";
import { CirclesClient } from "./CirclesClient";
import styles from "./circles.module.css";

export const metadata: Metadata = { title: "Circles | Buildmates", description: "Small builder groups formed from relevant connections.", robots: { index: false, follow: false } };

export default async function CirclesPage() {
  const user = await requireUser("/circles");
  const { DB } = await getPlatformBindings();
  const [circles, suggestions] = await Promise.all([listCircles(DB, user.id), listCircleSuggestions(DB, user.id)]);
  return <main className={styles.page}>
    <header><a href="/">Buildmates</a><nav><a href="/connections">Connections</a><a href="/inbox">Inbox</a></nav></header>
    <section className={styles.intro}><p>Build together</p><h1>Circles form when a conversation wants more room.</h1><span>Start a small group with a clear purpose. Add trackers, resources, or a scoreboard only after members approve the upgrade.</span></section>
    <CirclesClient initialCircles={circles} initialSuggestions={suggestions} />
  </main>;
}
