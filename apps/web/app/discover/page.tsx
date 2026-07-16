import type { Metadata } from "next";
import Link from "next/link";
import { ProductFooter, ProductHeader } from "../../components/discovery/ProductHeader";
import { FollowButton } from "../../components/discovery/FollowButton";
import { getCurrentUser } from "../../src/auth/require-user";
import { listDiscovery, type DiscoveryOptions } from "../../src/discovery/service";
import { getPlatformBindings } from "../../src/platform/bindings";
import styles from "../discovery.module.css";

export const metadata: Metadata = {
  title: "Discover",
  description: "Search visible builders and projects by current work, interest, stage, or coarse location.",
};

type Params = {
  q?: string;
  location?: string;
  timezone?: string;
  stage?: string;
  topic?: string;
  tool?: string;
  problem?: string;
  offer?: string;
  need?: string;
  cohort?: string;
  collaboration?: string;
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [viewer, { DB }] = await Promise.all([getCurrentUser(), getPlatformBindings()]);
  const result = await listDiscovery(DB, viewer?.id ?? null, { ...params, query: params.q } as DiscoveryOptions);
  const hasQuery = Object.values(params).some(Boolean);

  return <main className={styles.page}>
    <ProductHeader signedIn={Boolean(viewer)} />
    <div className={styles.main}>
      <header className={styles.head}>
        <h1>What are people<br />building now?</h1>
        <p>Find people through the work, ideas, ambitions, location, or stage you share. Only approved public context appears here.</p>
      </header>
      <form className={styles.search} action="/discover">
        <div className={styles.primaryFilters}>
          <input name="q" defaultValue={params.q ?? ""} placeholder="RAG, voice agents, local climate…" aria-label="Search builders and projects" />
          <input name="topic" defaultValue={params.topic ?? ""} placeholder="Topic" aria-label="Topic" />
          <input name="stage" defaultValue={params.stage ?? ""} placeholder="Project stage" aria-label="Project stage" />
          <input name="location" defaultValue={params.location ?? ""} placeholder="Coarse location" aria-label="Coarse location" />
          <button type="submit">Search</button>
        </div>
        <details className={styles.advanced} open={Boolean(params.timezone || params.tool || params.problem || params.offer || params.need || params.cohort || params.collaboration)}>
          <summary>More filters</summary>
          <div className={styles.advancedFields}>
            <input name="collaboration" defaultValue={params.collaboration ?? ""} placeholder="Connection intent" aria-label="Connection intent" />
            <input name="tool" defaultValue={params.tool ?? ""} placeholder="Tool" aria-label="Tool" />
            <input name="timezone" defaultValue={params.timezone ?? ""} placeholder="Timezone" aria-label="Timezone" />
            <input name="cohort" defaultValue={params.cohort ?? ""} placeholder="Cohort" aria-label="Cohort" />
            <input name="problem" defaultValue={params.problem ?? ""} placeholder="Current challenge (optional)" aria-label="Current challenge" />
            <input name="offer" defaultValue={params.offer ?? ""} placeholder="Can share (optional)" aria-label="What they can share" />
            <input name="need" defaultValue={params.need ?? ""} placeholder="Would value (optional)" aria-label="What they would value" />
          </div>
        </details>
      </form>
      <p className={styles.summary} aria-live="polite">{result.builders.length} builders · {result.projects.length} projects{hasQuery ? " match this view" : " are currently visible"}</p>
      {!result.builders.length && !result.projects.length ? <div className={styles.empty}>
        <h2>No strong result yet.</h2>
        <p>Your profile is still useful. Publish it, invite a builder whose work you follow, or ask Buildmates to notify you when someone relevant joins.</p>
        <div className={styles.coldActions}>
          <Link className={styles.action} href={viewer ? "/invite" : "/onboarding"}>{viewer ? "Invite a builder" : "Create your profile"}</Link>
          {viewer && <Link className={styles.textAction} href="/matches">Check recommendations</Link>}
        </div>
      </div> : <>
        <section className={styles.section}>
          <div className={styles.sectionHead}><h2>Builders</h2>{viewer && <Link href="/matches">See private recommendations</Link>}</div>
          <div className={styles.results}>{result.builders.map((builder) => <article className={styles.builder} key={builder.userId}>
            <span className={styles.meta}>@{builder.handle}{builder.coarseLocation ? ` · ${builder.coarseLocation}` : ""}</span>
            <h3>{builder.displayName}</h3>
            <p>{builder.currentWork ?? builder.summary}</p>
            <span className={styles.meta}>{builder.projectCount} visible {builder.projectCount === 1 ? "project" : "projects"}</span>
            <Link href={`/builders/${builder.handle}`}>Open profile</Link>
            {viewer && builder.userId !== viewer.id && <FollowButton targetKind="profile" targetId={builder.userId} />}
          </article>)}</div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}><h2>Projects</h2><Link href="/graph">View build graph</Link></div>
          <div className={styles.results}>{result.projects.map((project) => <article className={styles.project} key={project.id}>
            <span className={styles.meta}>{project.stage} · @{project.ownerHandle}</span>
            <h3>{project.title}</h3>
            <p>{project.summary}</p>
            {project.topics.length > 0 && <span className={styles.topics}>{project.topics.join(" · ")}</span>}
            <Link href={`/projects/${project.slug}`}>View project</Link>
            {viewer && <FollowButton targetKind="project" targetId={project.id} />}
          </article>)}</div>
        </section>
      </>}
    </div>
    <ProductFooter />
  </main>;
}
