import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../components/discovery/ProductHeader";
import styles from "./landing.module.css";

export const metadata: Metadata = { title: { absolute: "Buildmates" }, description: "Meet builders through what you are working on now." };

export default function Home() {
  return <main className={styles.page}>
    <ProductHeader signedIn={false} />
    <section className={styles.hero}>
      <div className={styles.statement}><p className={styles.overline}>the builder network that keeps up</p><h1>find your people<br />through what you build.</h1><p>Buildmates turns approved signals from your current work into a living profile, then finds people whose work, ambition, stage, or location makes meeting worthwhile.</p><div className={styles.heroActions}><Link className={styles.primary} href="/onboarding">Build your profile <span aria-hidden="true">↗</span></Link><Link className={styles.secondary} href="/product">See how it works</Link></div></div>
      <div className={styles.signalField} aria-label="How Buildmates forms a connection">
        <p className={styles.fieldLabel}><span>live route</span> a connection, from signal to room</p>
        <ol>
          <li style={{"--offset":"0%"} as React.CSSProperties}><span>01 · approved context</span><strong>What you are building now</strong><small>A concise Work Signal you can inspect or revoke.</small></li>
          <li style={{"--offset":"9%"} as React.CSSProperties}><span>02 · mutual relevance</span><strong>Work, ambition, stage, or place</strong><small>Deterministic retrieval narrows the field for both sides.</small></li>
          <li style={{"--offset":"3%"} as React.CSSProperties}><span>03 · introduction</span><strong>A room with a reason to exist</strong><small>Each person&rsquo;s Codex evaluates the introduction before the room can open.</small></li>
        </ol>
      </div>
    </section>
    <section className={styles.promise}><p>one Buildmates app.<br />your raw context stays out.</p><div><strong>Codex understands</strong><span>You approve the work summaries that leave your conversation.</span></div><div><strong>Scores narrow the field</strong><span>A deterministic system retrieves candidates without always-on inference.</span></div><div><strong>Both sides evaluate</strong><span>Manual acceptance or Full Autopilot follows each person&rsquo;s saved choice.</span></div></section>
    <section className={styles.network}><div><h2>A builder network,<br />not a lead list.</h2><p>Similar work can start a conversation. So can adjacent ambition, location, stage, or curiosity. Nobody has to arrive with a transaction.</p></div><nav aria-label="Explore Buildmates"><Link href="/discover">Search builders and projects</Link><Link href="/map">Browse coarse locations</Link><Link href="/cohorts">Enter a cohort</Link></nav></section>
    <section className={styles.control}><h2>Your context does not become our raw data feed.</h2><p>Codex reads only sources you allow, creates a concise Work Signal summary, and asks before sharing when your source policy requires it. Revoke a source or signal at any time.</p><Link href="/privacy">Read the privacy model</Link></section>
    <ProductFooter />
  </main>;
}
