import type { Metadata } from "next";
import Link from "next/link";
import {
  ProductFooter,
  ProductHeader,
} from "../components/discovery/ProductHeader";
import { CodexHandoff } from "../components/discovery/CodexHandoff";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "Buildmates" },
  description: "Meet builders through what you are working on now.",
};

export default function Home() {
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
            Codex turns the work you choose to share into a living profile, then
            Buildmates finds people whose work, ambition, stage, or location
            gives you a reason to talk.
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
        <p>
          one Buildmates app.
          <br />
          you choose what to share.
        </p>
        <div>
          <strong>Codex builds your profile</strong>
          <span>
            Turn the work you care about into a page that feels like you.
          </span>
        </div>
        <div>
          <strong>Meet through real overlap</strong>
          <span>
            Find people connected to what you are building, learning, or aiming
            for.
          </span>
        </div>
        <div>
          <strong>Choose your pace</strong>
          <span>
            Review every introduction or let Full Autopilot handle strong
            matches.
          </span>
        </div>
      </section>
      <section className={styles.network}>
        <div>
          <h2>
            Mutual relevance
            <br />
            over popularity.
          </h2>
          <p>
            Similar work can start a conversation. So can adjacent ambition,
            location, stage, or simple curiosity. The overlap only needs to be
            interesting to both people.
          </p>
        </div>
        <nav aria-label="Explore Buildmates">
          <Link href="/map">View city activity</Link>
          <Link href="/graph">Follow the build graph</Link>
        </nav>
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
