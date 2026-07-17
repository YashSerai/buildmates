import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../components/discovery/ProductHeader";
import styles from "./landing.module.css";

export const metadata: Metadata = { title: { absolute: "Buildmates" }, description: "Meet builders through what you are working on now." };

export default function Home() {
  return <main className={styles.page}>
    <ProductHeader signedIn={false} />
    <section className={styles.hero}>
      <div className={styles.statement}><h1><span>find your people</span><span>through what you build.</span></h1><p>Buildmates turns the work you choose to share into a living profile, then finds people whose work, ambition, stage, or location gives you a reason to talk.</p><div className={styles.heroActions}><Link className={styles.primary} href="/onboarding">Build your profile <span aria-hidden="true">↗</span></Link></div></div>
      <div className={styles.signalField} aria-label="How Buildmates forms a connection">
        <p className={styles.fieldLabel}><span>live route</span> a connection, from signal to room</p>
        <ol>
          <li style={{"--offset":"0%"} as React.CSSProperties}><span>01 · approved context</span><strong>What you are building now</strong><small>A concise Work Signal you can inspect or revoke.</small></li>
          <li style={{"--offset":"9%"} as React.CSSProperties}><span>02 · mutual relevance</span><strong>Work, ambition, stage, or place</strong><small>Buildmates narrows the field to people worth considering on both sides.</small></li>
          <li style={{"--offset":"3%"} as React.CSSProperties}><span>03 · introduction</span><strong>A room with a reason to exist</strong><small>Each side follows its saved acceptance rules before the room opens.</small></li>
        </ol>
      </div>
    </section>
    <section className={styles.promise}><p>one Buildmates app.<br />your private context stays out.</p><div><strong>Codex understands</strong><span>You approve the work summaries that leave your conversation.</span></div><div><strong>Relevance narrows the field</strong><span>Codex considers a small, focused set instead of searching the entire network.</span></div><div><strong>Both sides evaluate</strong><span>Manual acceptance or Full Autopilot follows each person&rsquo;s saved choice.</span></div></section>
    <section className={styles.network}><div><h2>Mutual relevance<br />over popularity.</h2><p>Similar work can start a conversation. So can adjacent ambition, location, stage, or simple curiosity. The overlap only needs to be interesting to both people.</p></div><nav aria-label="Explore Buildmates"><Link href="/map">View city activity</Link><Link href="/graph">Follow the build graph</Link></nav></section>
    <section className={styles.control}><h2>Your context stays under your control.</h2><p>Codex reads only sources you allow, creates a concise Work Signal summary, and asks before sharing when your source policy requires it. Revoke a source or signal at any time.</p><Link href="/privacy">Read the privacy model</Link></section>
    <ProductFooter />
  </main>;
}
