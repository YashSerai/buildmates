import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  profileMediaBinding,
  type SurfaceBindings,
} from "@buildmates/surfaces";
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
  const [revision, publicFields, publicProjects, approvedMedia] =
    await Promise.all([
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
  const surfaceFacts = publicFields.results
    .filter((field) => field.key !== "projects")
    .map((field) => ({
      label: profileFieldLabel(field.key),
      value: surfaceFactValue(field.valueJson),
    }))
    .filter((fact) => fact.value.length > 0);
  const approvedDraftProjects = publicFields.results.flatMap((field) =>
    field.key === "projects" ? surfaceProjectsValue(field.valueJson) : [],
  );
  const currentWorkProjects =
    approvedDraftProjects.length || publicProjects.results.length
      ? []
      : profile.fields.flatMap((field) =>
          field.key === "current_work"
            ? currentWorkProjectsValue(JSON.stringify(field.value))
            : [],
        );
  const surfaceProjects = dedupeProjects([
    ...approvedDraftProjects,
    ...publicProjects.results.map((project) => ({
      id: project.id,
      title: project.title,
      summary: project.summary,
      href: `/projects/${project.slug}`,
      tags: [],
      metrics: [],
    })),
    ...currentWorkProjects,
  ]);
  const surfaceMediaBindings = publishedSpec
    ? approvedSurfaceMediaBindings(publishedSpec, approvedMedia)
    : {};
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
  if (Array.isArray(value))
    return value.map(surfaceText).filter(Boolean).join(", ");
  return surfaceText(value);
}

function surfaceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

function profileFieldLabel(key: string) {
  return (
    (
      {
        current_work: "Current work",
        interests: "Interests",
        ambitions: "Ambitions",
        exploring: "Exploring",
        networking_intent: "Who I want to meet",
      } as Record<string, string>
    )[key] ?? key.replaceAll("_", " ")
  );
}

type ProfileProjectBinding = {
  id: string;
  title: string;
  summary: string;
  href?: string;
  tags: string[];
  metrics: Array<{ label: string; value: string }>;
};
function surfaceProjectsValue(valueJson: string): ProfileProjectBinding[] {
  const value = safeJson(valueJson);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const project = item as Record<string, unknown>;
    if (
      typeof project.id !== "string" ||
      typeof project.title !== "string" ||
      typeof project.summary !== "string"
    )
      return [];
    return [
      {
        id: project.id,
        title: project.title,
        summary: project.summary,
        tags: Array.isArray(project.tags)
          ? project.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        metrics: Array.isArray(project.metrics)
          ? project.metrics.flatMap((metric) =>
              metric &&
              typeof metric === "object" &&
              typeof (metric as Record<string, unknown>).label === "string" &&
              typeof (metric as Record<string, unknown>).value === "string"
                ? [
                    {
                      label: String((metric as Record<string, unknown>).label),
                      value: String((metric as Record<string, unknown>).value),
                    },
                  ]
                : [],
            )
          : [],
      },
    ];
  });
}

function currentWorkProjectsValue(valueJson: string): ProfileProjectBinding[] {
  const value = safeJson(valueJson);
  const entries = (
    Array.isArray(value) ? value.map(surfaceText) : [surfaceText(value)]
  )
    .flatMap((entry) => entry.split(/[;\n]/))
    .map((entry) => entry.trim().replace(/[.]$/, ""))
    .filter(Boolean);
  return entries.map((title, index) => ({
    id: `current-work-${index}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`,
    title,
    summary: "Currently part of this builder's approved work context.",
    tags: [],
    metrics: [],
  }));
}

function dedupeProjects(projects: ProfileProjectBinding[]) {
  const seen = new Set<string>();
  return projects
    .filter((project) => !seen.has(project.id) && (seen.add(project.id), true))
    .slice(0, 20);
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
  const facts = profile.fields
    .filter((field) => field.key !== "projects")
    .map((field) => ({
      label:
        factLabels[String(field.key)] ?? String(field.key).replaceAll("_", " "),
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
      <div className={styles.page}>
        <aside
          className={styles.inlineProfileActions}
          aria-label="Profile actions"
        >
          <div className={styles.publicProfileActionGroup}>
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
          {ownProfile ? (
            <div className={styles.draftProfileReminder}>
              <span>Your custom page is not published yet.</span>
              <Link href="/profile/design">Design with Codex</Link>
              <Link href="/profile/edit">Edit details</Link>
            </div>
          ) : null}
        </aside>
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
          {profile.surfaceProjects.length ? (
            <div className={styles.cards}>
              {profile.surfaceProjects.map((project) =>
                project.href ? (
                  <Link
                    className={styles.card}
                    key={project.id}
                    href={project.href}
                  >
                    <h3>{project.title}</h3>
                    <p>{project.summary}</p>
                  </Link>
                ) : (
                  <article className={styles.card} key={project.id}>
                    <h3>{project.title}</h3>
                    <p>{project.summary}</p>
                  </article>
                ),
              )}
            </div>
          ) : (
            <p className={styles.empty}>No visible projects yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function approvedSurfaceMediaBindings(
  spec: unknown,
  available: Awaited<ReturnType<typeof listApprovedProfileMedia>>,
): SurfaceBindings {
  if (!spec || typeof spec !== "object") return {};
  const candidate = spec as {
    approvedAssets?: unknown;
    bindingManifest?: { media?: unknown };
  };
  if (
    !Array.isArray(candidate.approvedAssets) ||
    !Array.isArray(candidate.bindingManifest?.media)
  )
    return {};
  const approvedAssets = new Map(
    candidate.approvedAssets.flatMap((asset) => {
      if (!asset || typeof asset !== "object") return [];
      const value = asset as { id?: unknown; src?: unknown };
      return typeof value.id === "string" && typeof value.src === "string"
        ? [[value.id, value.src] as const]
        : [];
    }),
  );
  const declarations = candidate.bindingManifest.media.filter(
    (
      item,
    ): item is { key: string; altKey: string; approvedAssetIds: string[] } => {
      if (!item || typeof item !== "object") return false;
      const value = item as {
        key?: unknown;
        altKey?: unknown;
        approvedAssetIds?: unknown;
      };
      return (
        typeof value.key === "string" &&
        typeof value.altKey === "string" &&
        Array.isArray(value.approvedAssetIds) &&
        value.approvedAssetIds.every((id) => typeof id === "string")
      );
    },
  );
  const bindings: Record<string, { assetId: string; alt: string } | string> =
    {};
  for (const media of available) {
    const binding = profileMediaBinding(media.assetId);
    const declaration = declarations.find(
      (item) =>
        item.key === binding.key &&
        item.altKey === binding.altKey &&
        item.approvedAssetIds.includes(media.assetId),
    );
    if (!declaration || approvedAssets.get(media.assetId) !== media.src)
      continue;
    bindings[binding.key] = { assetId: media.assetId, alt: media.altText };
    bindings[binding.altKey] = media.altText;
  }
  return bindings;
}
