import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SurfaceRenderer } from "../../../components/surfaces/SurfaceRenderer";
import { getCurrentUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { getProfileByHandle } from "../../../src/profile-projects/service";
import styles from "../../profile-projects.module.css";

async function load(handle: string) {
  const [viewer, { DB }] = await Promise.all([getCurrentUser(), getPlatformBindings()]);
  const profile = await getProfileByHandle(DB, handle, viewer?.id ?? null).catch(() => null);
  if (!profile) return null;
  const revision = await DB.prepare("SELECT r.spec_json AS specJson FROM surfaces s JOIN surface_revisions r ON r.id=s.published_revision_id WHERE s.kind='profile' AND s.subject_id=? AND r.status='published'").bind(profile.id).first<{ specJson: string }>();
  let publishedSpec:unknown=null;try{publishedSpec=revision?JSON.parse(revision.specJson):null}catch{publishedSpec=null}
  return { ...profile, publishedSpec };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params; const profile = await load(handle);
  if (!profile) return { title: "Builder not found", robots: { index: false, follow: false } };
  const index = profile.audience === "public" && profile.indexable;
  return { title: `${profile.displayName} - Buildmates`, description: String(profile.summary), robots: { index, follow: index }, alternates:{canonical:`/@${profile.handle}`} };
}

export default async function BuilderPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params; const profile = await load(handle); if (!profile) notFound();
  const facts = profile.fields.map((field) => ({ label: String(field.key).replaceAll("_", " "), value: Array.isArray(field.value) ? field.value.join(", ") : String(field.value) }));
  const projects = profile.projects.map((project) => ({ id: String(project.id), title: String(project.title), summary: String(project.summary), href: `/projects/${project.slug}` }));
  if (profile.publishedSpec) return <main><SurfaceRenderer spec={profile.publishedSpec} bindings={{ "profile.displayName": String(profile.displayName), "profile.summary": String(profile.summary), "profile.facts": facts, "profile.projects": projects }} />{profile.workSignals.length>0&&<section className={styles.page} aria-labelledby="work-signals"><h2 id="work-signals">Current Work Signals</h2><div className={styles.cards}>{profile.workSignals.map((signal)=><article className={styles.card} key={signal.id}><p>{signal.summary}</p></article>)}</div></section>}</main>;
  return <main className={styles.page}>
    <header className={styles.profileHeader}><p className={styles.kicker}>@{profile.handle}</p><h1>{String(profile.displayName)}</h1><p className={styles.lede}>{String(profile.summary)}</p>{profile.coarseLocation && <p className={styles.muted}>{String(profile.coarseLocation)}</p>}</header>
    <section aria-labelledby="context"><h2 id="context">Current context</h2>{facts.length ? <dl className={styles.facts}>{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : <p className={styles.empty}>This builder has not shared more context with you.</p>}</section>
    {profile.statistics.length > 0 && <section aria-labelledby="statistics"><h2 id="statistics">Shared statistics</h2><dl className={styles.facts}>{profile.statistics.map((statistic)=><div key={statistic.key}><dt>{statistic.label}</dt><dd>{statistic.value} <small>{statistic.provenance.replaceAll('_',' ')}</small></dd></div>)}</dl></section>}
    {profile.workSignals.length > 0 && <section aria-labelledby="work-signals"><h2 id="work-signals">Current Work Signals</h2><div className={styles.cards}>{profile.workSignals.map((signal)=><article className={styles.card} key={signal.id}><p>{signal.summary}</p></article>)}</div></section>}
    <section aria-labelledby="projects"><h2 id="projects">Projects</h2>{profile.projects.length ? <div className={styles.cards}>{profile.projects.map((project) => <Link className={styles.card} key={String(project.id)} href={`/projects/${project.slug}`}><p className={styles.kicker}>{String(project.stage)}</p><h3>{String(project.title)}</h3><p>{String(project.summary)}</p></Link>)}</div> : <p className={styles.empty}>No visible projects yet.</p>}</section>
  </main>;
}
