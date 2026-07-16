import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductFooter, ProductHeader } from "../../../components/discovery/ProductHeader";
import { getCurrentUser } from "../../../src/auth/require-user";
import { getCohort } from "../../../src/discovery/service";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { CohortInvite, JoinCohort } from "../CohortActions";
import { CohortAdmin } from "../CohortAdmin";
import styles from "../cohorts.module.css";

async function load(slug: string) { const [viewer, { DB }] = await Promise.all([getCurrentUser(), getPlatformBindings()]); return { viewer, cohort: await getCohort(DB, slug, viewer?.id ?? null) }; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const { cohort } = await load(slug); return cohort ? { title: cohort.name, description: cohort.description, robots: { index: cohort.visibility === "public", follow: cohort.visibility === "public" } } : { title: "Cohort not found", robots: { index: false, follow: false } }; }

export default async function CohortPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const { viewer, cohort } = await load(slug); if (!cohort) notFound();
  const canAdmin = ["owner", "admin"].includes(cohort.viewerRole ?? "");
  return <main className={styles.page}><ProductHeader signedIn={Boolean(viewer)} /><div className={styles.main}><header className={styles.detailHead}><Link href="/cohorts">All cohorts</Link><h1>{cohort.name}</h1><p>{cohort.description}</p><span className={styles.meta}>{cohort.memberCount} {cohort.memberCount === 1 ? "member" : "members"} · {cohort.visibility}</span>{viewer && ["public", "request"].includes(cohort.visibility) && <JoinCohort id={cohort.id} currentStatus={cohort.viewerStatus} />}{!viewer && <div className={styles.actions}><Link className={styles.button} href="/account">Sign in to join</Link></div>}{canAdmin && <CohortInvite id={cohort.id} />}</header><section><h2>Builders in this cohort</h2>{cohort.members.length ? <div className={styles.memberList}>{cohort.members.map((member) => <article className={styles.member} key={member.handle}><span className={styles.meta}>{member.role}</span><h3>{member.displayName}</h3><p>{member.summary}</p><Link href={`/builders/${member.handle}`}>@{member.handle}</Link></article>)}</div> : <p>No visible member profiles yet.</p>}</section>{canAdmin && <CohortAdmin cohort={{ id: cohort.id, name: cohort.name, description: cohort.description, visibility: cohort.visibility, viewerRole: cohort.viewerRole }} members={cohort.members} pendingMembers={cohort.pendingMembers} />}</div><ProductFooter /></main>;
}
