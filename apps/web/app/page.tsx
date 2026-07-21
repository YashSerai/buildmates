import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ProductFooter,
  ProductHeader,
} from "../components/discovery/ProductHeader";
import { CodexHandoff } from "../components/discovery/CodexHandoff";
import { getCurrentUser } from "../src/auth/require-user";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "Buildmates" },
  description: "Meet builders through what you are working on now.",
};

export default async function Home() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <main className={styles.page}>
      <ProductHeader signedIn={false} />
      <section className={styles.hero}>
        <div className={styles.statement}>
          <h1>
            <span>find your people</span>
            <span>through what you build.</span>
          </h1>
          <p>
            Codex turns the work you&rsquo;re already doing into a living
            profile, then finds builders whose work or ambition gives you a
            reason to connect.
          </p>
          <div className={styles.heroActions}>
            <CodexHandoff className={styles.codexHandoff} />
          </div>
        </div>
        <div
          className={styles.signalField}
          aria-label="How Buildmates forms a connection"
        >
          <p className={styles.fieldLabel}>
            <span>How it works</span> From profile to conversation
          </p>
          <ol>
            <li>
              <span>01 · Your profile</span>
              <strong>Share what you are building</strong>
              <small>Choose what appears on your profile.</small>
            </li>
            <li>
              <span>02 · A useful overlap</span>
              <strong>Meet someone worth talking to</strong>
              <small>
                Buildmates looks for shared work, ambition, stage, or place.
              </small>
            </li>
            <li>
              <span>03 · A room together</span>
              <strong>Start with context</strong>
              <small>Your room opens with a simple reason to connect.</small>
            </li>
          </ol>
        </div>
      </section>
      <section className={styles.promise}>
        <div>
          <strong>Networking through real work</strong>
          <span>
            Meet people shipping products, exploring ideas, and solving real
            problems.
          </span>
        </div>
        <div>
          <strong>Mutual relevance over popularity</strong>
          <span>
            Similar work can start a conversation. So can adjacent ambition,
            stage, location, or curiosity. The overlap only needs to matter to
            both people.
          </span>
        </div>
        <div>
          <strong>Your profile keeps up</strong>
          <span>
            Once you approve the sources, Codex brings in your projects,
            refreshes your profile, and looks for relevant builders as your work
            changes.
          </span>
        </div>
      </section>
      <section className={styles.spaces}>
        <div className={styles.spacesIntro}>
          <h2>Generative UI for every connection.</h2>
          <p>
            Start with a conversation. When you need more, tell Codex what the
            space should become. It can shape the room around why you met,
            creating a custom interface with a timer, checklist, research board,
            decision log, or another useful tool.
          </p>
        </div>
        <div className={styles.spaceDetails}>
          <article>
            <span>One-to-one rooms</span>
            <strong>A custom room for two builders</strong>
            <p>
              Builders discussing RAG might get a shared research board.
              Cofounders might add a decision log or launch checklist. Codex
              designs the space and publishes it only after approval.
            </p>
            <small>Timer · Checklist · Research board · Decision log</small>
          </article>
          <article>
            <span>Circle spaces</span>
            <strong>The same idea, expanded to a group</strong>
            <p>
              A Circle is a group conversation with its own custom interface and
              tools. A shipping group might add a sprint timer and tracker. A
              local community might create an event board. Codex designs the
              shared space, and its members decide what goes live.
            </p>
            <small>Sprint timer · Tracker · Event board · Shared tools</small>
          </article>
        </div>
      </section>
      <section className={styles.network}>
        <article>
          <h2>See where builders are.</h2>
          <p>
            Explore anonymous city activity and see where builders and new
            connections are taking shape without exposing anyone&rsquo;s precise
            location.
          </p>
          <Link href="/map">View city activity</Link>
        </article>
        <article>
          <h2>See where ideas overlap.</h2>
          <p>
            Move through the topics builders are working on and see which ideas,
            tools, and fields are being explored together.
          </p>
          <Link href="/graph">Follow the build graph</Link>
        </article>
      </section>
      <section className={styles.control}>
        <h2>Share only what you choose.</h2>
        <p>
          You decide what becomes part of your profile and what helps with
          matching. Change or remove it whenever you like.
        </p>
        <Link href="/privacy">How privacy works</Link>
      </section>
      <ProductFooter />
    </main>
  );
}
