import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { profileMediaBinding, type SurfaceBindings } from "@buildmates/surfaces";
import { SurfaceRenderer } from "../../../components/surfaces/SurfaceRenderer";
import { FollowButton } from "../../../components/discovery/FollowButton";
import { ProductHeader } from "../../../components/discovery/ProductHeader";
import { ShareButton } from "../../../components/discovery/ShareButton";
import { getCurrentUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { getProfileByHandle } from "../../../src/profile-projects/service";
import { listApprovedProfileMedia } from "../../../src/platform/surface-assets";
import styles from "../../profile-projects.module.css";

async function load(handle: string) {
  const [viewer, { DB }] = await Promise.all([
    getCurrentUser(),
    getPlatformBindings(),
  ]);
  const profile = await getProfileByHandle(
    DB,
    handle,
    viewer?.id ?? null,
  ).catch(() => null);
  if (!profile) return null;
  const [revision, publicFields, publicProjects, approvedMedia] = await Promise.all([
    DB.prepare(
      "SELECT r.spec_json AS specJson FROM surfaces s JOIN surface_revisions r ON r.id=s.published_revision_id WHERE s.kind='profile' AND s.subject_id=? AND r.status='published'",
    )
      .bind(profile.id)
      .first<{ specJson: string }>(),
    DB.prepare(
      "SELECT field_key AS key,value_json AS valueJson FROM profile_fields WHERE profile_id=? AND audience='public' ORDER BY field_key",
    )
      .bind(profile.id)
      .all<{ key: string; valueJson: string }>(),
    DB.prepare(
      "SELECT id,title,summary,slug FROM projects WHERE owner_user_id=? AND status='active' AND audience='public' ORDER BY updated_at DESC LIMIT 20",
    )
      .bind(profile.userId)
      .all<{ id: string; title: string; summary: string; slug: string }>(),
    listApprovedProfileMedia({ DB, actorId: profile.userId }),
  ]);
  let publishedSpec: unknown = null;
  try {
    publishedSpec = revision ? JSON.parse(revision.specJson) : null;
  } catch {
    publishedSpec = null;
  }
  const surfaceFacts = publicFields.results.map((field) => ({
    label: field.key.replaceAll("_", " "),
    value: surfaceFactValue(field.valueJson),
  }));
  const surfaceProjects = publicProjects.results.map((project) => ({
    id: project.id,
    title: project.title,
    summary: project.summary,
    href: `/projects/${project.slug}`,
  }));
  const surfaceMediaBindings = publishedSpec ? approvedSurfaceMediaBindings(publishedSpec, approvedMedia) : {};
  return {
    ...profile,
    publishedSpec,
    surfaceFacts,
    surfaceProjects,
    surfaceMediaBindings,
    viewerId: viewer?.id ?? null,
  };
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function surfaceFactValue(valueJson: string): string {
  const value = safeJson(valueJson);
  if (Array.isArray(value)) return value.map(surfaceText).filter(Boolean).join(", ");
  return surfaceText(value);
}

function surfaceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await load(handle);
  if (!profile)
    return {
      title: "Builder not found",
      robots: { index: false, follow: false },
    };
  const index = profile.audience === "public" && profile.indexable;
  const title = `${profile.displayName} on Buildmates`;
  const description = String(profile.summary);
  const canonical = `/builders/${encodeURIComponent(profile.handle)}`;
  return {
    title,
    description,
    robots: { index, follow: index },
    alternates: { canonical },
    openGraph: { title, description, type: "profile", url: canonical },
  };
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await load(handle);
  if (!profile) notFound();
  const factLabels: Record<string, string> = {
    current_work: "Building now",
    previous_work: "Previous work",
    interests: "Interests",
    ambitions: "Ambitions",
    stage: "Current stage",
    exploring: "Exploring",
    offers: "Happy to share",
    needs: "Would value",
    networking_intent: "Interested in meeting",
    cohorts: "Communities",
  };
  const facts = profile.fields.map((field) => ({
    label: factLabels[String(field.key)] ?? String(field.key).replaceAll("_", " "),
    value: Array.isArray(field.value)
      ? field.value.join(", ")
      : String(field.value),
  }));
  const ownProfile = profile.viewerId === profile.userId;
  const ownPublishedProfile = ownProfile && Boolean(profile.publishedSpec);
  const trustedActions = (
    <aside className={styles.publicProfileActions} aria-label="Profile actions">
      <div className={styles.publicProfileActionGroup}>
        <Link href="/">Buildmates</Link>
        <ShareButton
          label="Share profile"
          title={`${profile.displayName} on Buildmates`}
        />
        {profile.viewerId && !ownProfile ? (
          <FollowButton
            targetKind="profile"
            targetId={profile.userId}
            label="Follow builder"
          />
        ) : null}
        {!profile.viewerId ? (
          <Link href="/onboarding">Join Buildmates to follow</Link>
        ) : null}
      </div>
      {ownPublishedProfile ? (
        <div className={styles.ownerProfileReminder}>
          <span>This is your published profile.</span>
          <span>
            Want a new direction? Tell Codex what to change, then review it
            before publishing.
          </span>
          <Link href="/profile/design">Redesign with Codex</Link>
          <Link href="/profile/edit">Edit details</Link>
        </div>
      ) : null}
    </aside>
  );
  if (profile.publishedSpec)
    return (
      <main className={styles.profileShell}>
        {trustedActions}
        <SurfaceRenderer
          className={styles.publishedSurface}
          spec={profile.publishedSpec}
          bindings={{
            "profile.displayName": String(profile.displayName),
            "profile.summary": String(profile.summary),
            "profile.facts": profile.surfaceFacts,
            "profile.projects": profile.surfaceProjects,
            ...profile.surfaceMediaBindings,
          }}
        />
      </main>
    );
  return (
    <main className={styles.profileShell}>
      <ProductHeader signedIn={Boolean(profile.viewerId)} />
      {trustedActions}
      <div className={styles.page}>
        <header className={styles.profileHeader}>
          <p className={styles.kicker}>@{profile.handle}</p>
          <h1>{String(profile.displayName)}</h1>
          <p className={styles.lede}>{String(profile.summary)}</p>
          {profile.coarseLocation && (
            <p className={styles.muted}>{String(profile.coarseLocation)}</p>
          )}
        </header>
        <section aria-labelledby="context">
          <h2 id="context">Current context</h2>
          {facts.length ? (
            <dl className={styles.facts}>
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={styles.empty}>
              This builder has not shared more context with you.
            </p>
          )}
        </section>
        {profile.statistics.length > 0 && (
          <section aria-labelledby="statistics">
            <h2 id="statistics">In numbers</h2>
            <dl className={styles.facts}>
              {profile.statistics.map((statistic) => (
                <div key={statistic.key}>
                  <dt>{statistic.label}</dt>
                  <dd>{statistic.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <section aria-labelledby="projects">
          <h2 id="projects">Projects</h2>
          {profile.projects.length ? (
            <div className={styles.cards}>
              {profile.projects.map((project) => (
                <Link
                  className={styles.card}
                  key={String(project.id)}
                  href={`/projects/${project.slug}`}
                >
                  <p className={styles.kicker}>{String(project.stage)}</p>
                  <h3>{String(project.title)}</h3>
                  <p>{String(project.summary)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No visible projects yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function approvedSurfaceMediaBindings(spec: unknown, available: Awaited<ReturnType<typeof listApprovedProfileMedia>>): SurfaceBindings {
  if (!spec || typeof spec !== "object") return {};
  const candidate = spec as { approvedAssets?: unknown; bindingManifest?: { media?: unknown } };
  if (!Array.isArray(candidate.approvedAssets) || !Array.isArray(candidate.bindingManifest?.media)) return {};
  const approvedAssets = new Map(candidate.approvedAssets.flatMap((asset) => {
    if (!asset || typeof asset !== "object") return [];
    const value = asset as { id?: unknown; src?: unknown };
    return typeof value.id === "string" && typeof value.src === "string" ? [[value.id, value.src] as const] : [];
  }));
  const declarations = candidate.bindingManifest.media.filter((item): item is { key: string; altKey: string; approvedAssetIds: string[] } => {
    if (!item || typeof item !== "object") return false;
    const value = item as { key?: unknown; altKey?: unknown; approvedAssetIds?: unknown };
    return typeof value.key === "string" && typeof value.altKey === "string" && Array.isArray(value.approvedAssetIds) && value.approvedAssetIds.every((id) => typeof id === "string");
  });
  const bindings: Record<string, { assetId: string; alt: string } | string> = {};
  for (const media of available) {
    const binding = profileMediaBinding(media.assetId);
    const declaration = declarations.find((item) => item.key === binding.key && item.altKey === binding.altKey && item.approvedAssetIds.includes(media.assetId));
    if (!declaration || approvedAssets.get(media.assetId) !== media.src) continue;
    bindings[binding.key] = { assetId: media.assetId, alt: media.altText };
    bindings[binding.altKey] = media.altText;
  }
  return bindings;
}
