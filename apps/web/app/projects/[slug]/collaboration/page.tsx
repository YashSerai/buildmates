import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductHeader } from "@/components/discovery/ProductHeader";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { normalizeSlug } from "@/src/profile-projects/service";
import { CollaborationDecision } from "./CollaborationDecision";
import styles from "../../../profile-projects.module.css";

export default async function CollaborationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const user = await requireUser(`/projects/${encodeURIComponent(slug)}/collaboration`);
  const { DB } = await getPlatformBindings();
  const invitation = await DB.prepare(`SELECT project.title,project.summary,profile.display_name AS ownerName,collaborator.role,collaborator.approved_at AS approvedAt
    FROM projects project JOIN profiles profile ON profile.user_id=project.owner_user_id
    JOIN project_collaborators collaborator ON collaborator.project_id=project.id AND collaborator.user_id=?
    WHERE project.slug=? AND project.status<>'deleted' LIMIT 1`).bind(user.id, slug).first<{ title: string; summary: string; ownerName: string; role: string; approvedAt: number | null }>();
  if (!invitation) notFound();
  return <><ProductHeader signedIn/><main className={styles.page}><div className={styles.profileActions}><Link className={styles.back} href="/inbox">Back to Activity</Link></div><header className={styles.projectHeader}><p className={styles.kicker}>Project collaboration</p><h1>{invitation.title}</h1><p className={styles.lede}>{invitation.ownerName} invited you as {projectRoleLabel(invitation.role)}. Accepting lets this project appear as approved shared context; it does not expose your private profile or connected apps.</p></header>{invitation.approvedAt ? <section><h2>Collaboration accepted</h2><p>You can now open the project and use the shared context approved for collaborators.</p><Link className={styles.back} href={`/projects/${encodeURIComponent(slug)}`}>Open project</Link></section> : <CollaborationDecision slug={slug} />}</main></>;
}

function projectRoleLabel(value: string) {
  if (value === "editor") return "an editor";
  if (value === "viewer") return "a viewer";
  return "a collaborator";
}
