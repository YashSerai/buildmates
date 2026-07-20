import { notFound } from "next/navigation";

import { ProductHeader } from "../../../../components/discovery/ProductHeader";
import { ProjectEditor } from "../../../../components/profile-projects/ProjectEditor";
import { requireUser } from "../../../../src/auth/require-user";
import { getPlatformBindings } from "../../../../src/platform/bindings";
import {
  listProjectTaxonomyChoices,
  normalizeSlug,
} from "../../../../src/profile-projects/service";
import styles from "../../../profile-projects.module.css";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, { DB }] = await Promise.all([
    requireUser(`/projects/${slug}/edit`),
    getPlatformBindings(),
  ]);
  const project = await DB.prepare(
    "SELECT id,title,summary,stage,status,audience,allow_matching AS allowMatching FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted'",
  )
    .bind(normalizeSlug(slug), user.id)
    .first<{
      id: string;
      title: string;
      summary: string;
      stage: string;
      status: string;
      audience: string;
      allowMatching: number;
    }>();

  if (!project) {
    notFound();
  }

  const [links, taxonomy, taxonomyChoices] = await Promise.all([
    DB.prepare(
      "SELECT label,url FROM project_links WHERE project_id=? ORDER BY position",
    )
      .bind(project.id)
      .all<{ label: string; url: string }>(),
    DB.prepare(
      "SELECT kind,taxonomy_item_id AS id FROM project_taxonomy_items WHERE project_id=? ORDER BY kind,taxonomy_item_id",
    )
      .bind(project.id)
      .all<{ kind: "topic" | "tool" | "domain"; id: string }>(),
    listProjectTaxonomyChoices(DB),
  ]);

  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.projectWorkspace}>
        <ProjectEditor
          existingSlug={slug}
          cancelHref={`/projects/${encodeURIComponent(slug)}`}
          taxonomyChoices={taxonomyChoices}
          initial={{
            ...project,
            allowMatching: Boolean(project.allowMatching),
            links: links.results,
            taxonomy: taxonomy.results,
          }}
        />
      </main>
    </>
  );
}
