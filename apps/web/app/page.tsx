import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../components/discovery/ProductHeader";
import { getCurrentUser } from "../src/auth/require-user";
import { listDiscovery } from "../src/discovery/service";
import { getPlatformBindings } from "../src/platform/bindings";
import styles from "./landing.module.css";

export const metadata: Metadata = { title: { absolute: "Buildmates" }, description: "Meet builders through what you are working on now." };

export default async function Home() {
  const viewer = await getCurrentUser();
  const discovery = await getPlatformBindings().then(({DB})=>listDiscovery(DB,viewer?.id ?? null,{limit:6})).catch(()=>({builders:[],projects:[]}));
  const signals = [...discovery.projects.map((project)=>({kind:"project",title:project.title,detail:`by @${project.ownerHandle}`,href:`/projects/${project.slug}`})),...discovery.builders.map((builder)=>({kind:"builder",title:builder.displayName,detail:builder.currentWork ?? builder.summary,href:`/builders/${builder.handle}`}))].slice(0,7);
  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(viewer)} />
    <section className={styles.hero}>
      <div className={styles.statement}><h1>Find your people<br />through what you build.</h1><p>Buildmates turns approved signals from your current work into a living profile, then finds mutually relevant builders without turning networking into a marketplace.</p><Link className={styles.primary} href={viewer ? "/discover" : "/onboarding"}>{viewer ? "Explore the network" : "Build your profile"}</Link></div>
      <div className={styles.signalField} aria-label="Recent public work in Buildmates">
        <p className={styles.fieldLabel}>Public work signals</p>
        {signals.length ? <ol>{signals.map((signal,index)=><li key={`${signal.kind}-${signal.href}`} style={{"--offset":`${(index%3)*9}%`} as React.CSSProperties}><span>{signal.kind}</span><Link href={signal.href}>{signal.title}</Link><small>{signal.detail}</small></li>)}</ol> : <div className={styles.emptyField}><strong>The network starts with one honest profile.</strong><p>Publish yours, share it, and Buildmates will let you know when someone relevant joins.</p></div>}
      </div>
    </section>
    <section className={styles.promise}><p>One Buildmates app. Your existing connected apps stay under their own permissions.</p><div><strong>Codex understands</strong><span>You approve the work summaries that leave your conversation.</span></div><div><strong>Scores narrow the field</strong><span>A deterministic system retrieves candidates without always-on inference.</span></div><div><strong>Both sides evaluate</strong><span>Manual acceptance or Full Autopilot follows each person&rsquo;s saved choice.</span></div></section>
    <section className={styles.network}><div><h2>A builder network,<br />not a lead list.</h2><p>Similar work can start a conversation. So can adjacent ambition, location, stage, or curiosity. Nobody has to arrive with a transaction.</p></div><nav aria-label="Explore Buildmates"><Link href="/discover">Search builders and projects</Link><Link href="/map">Browse coarse locations</Link><Link href="/cohorts">Enter a cohort</Link></nav></section>
    <section className={styles.control}><h2>Your context does not become our raw data feed.</h2><p>Codex reads only sources you allow, creates a bounded Work Signal summary, and asks before sharing when your source policy requires it. Revoke a source or signal at any time.</p><Link href="/privacy">Read the privacy model</Link></section>
    <ProductFooter />
  </main>;
}
