import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { listCandidateRows, listMatchInbox, serverTimestamp } from "@/src/matching/service";
import { MatchesClient } from "./MatchesClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./matches.module.css";
export const metadata:Metadata={title:"Matches | Buildmates",description:"Review relevant builders and reciprocal introductions.",robots:{index:false,follow:false}};
export default async function MatchesPage(){const user=await requireUser("/matches");const {DB}=await getPlatformBindings();const now=await serverTimestamp();const [candidates,proposals]=await Promise.all([listCandidateRows(DB,user.id,now,30),listMatchInbox(DB,user.id,now)]);return <><ProductHeader signedIn/><main className={styles.page}><section className={styles.intro}><p className={styles.eyebrow}>Mutual relevance</p><h1>People worth meeting now.</h1><p>Buildmates ranks people using the work signals you approved. Each person&apos;s Codex evaluates the introduction independently, and a room opens only when both sides&apos; chosen acceptance rules are satisfied.</p></section><MatchesClient initialCandidates={candidates} initialProposals={proposals}/></main></>}
