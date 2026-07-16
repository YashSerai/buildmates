import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listCandidateRows, listMatchInbox, serverTimestamp } from "@/src/matching/service";
import { MatchesClient } from "./MatchesClient";
import styles from "./matches.module.css";
export const metadata:Metadata={title:"Matches | Buildmates",description:"Review relevant builders and reciprocal introductions.",robots:{index:false,follow:false}};
export default async function MatchesPage(){const user=await requireUser("/matches");const {DB}=await getPlatformBindings();const now=await serverTimestamp();const [candidates,proposals]=await Promise.all([listCandidateRows(DB,user.id,now,30),listMatchInbox(DB,user.id,now)]);return <main className={styles.page}><header className={styles.header}><a href="/" className={styles.wordmark}>Buildmates</a><nav aria-label="Account"><a href="/profile">Profile</a><a href="/settings/privacy">Privacy</a></nav></header><section className={styles.intro}><p className={styles.eyebrow}>Mutual relevance</p><h1>People worth meeting now.</h1><p>Buildmates shortlists from approved signals. Your Codex and theirs evaluate independently before an introduction opens.</p></section><MatchesClient initialCandidates={candidates} initialProposals={proposals}/></main>}
