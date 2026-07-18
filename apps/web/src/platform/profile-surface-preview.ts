import { parseSurfaceSpecJson } from "@buildmates/surfaces";

export type ValidPrivateProfilePreview = {
  surfaceId: string;
  revisionId: string;
  revisionNumber: number;
  publishedRevisionNumber: number | null;
  governanceVersion: number;
  alreadyPublished: boolean;
};

export async function findValidPrivateProfilePreview(
  DB: D1Database,
  userId: string,
  revisionId?: string,
): Promise<ValidPrivateProfilePreview | null> {
  const revisionFilter = revisionId ? " AND revision.id=?" : "";
  const statement = DB.prepare(`SELECT surface.id AS surfaceId,
      surface.governance_version AS governanceVersion,
      surface.published_revision_id AS publishedRevisionId,
      published.revision_number AS publishedRevisionNumber,
      revision.id AS revisionId,
      revision.revision_number AS revisionNumber,
      revision.spec_json AS specJson
    FROM profiles profile
    JOIN surfaces surface ON surface.kind='profile' AND surface.subject_id=profile.id
    JOIN surface_revisions revision ON revision.surface_id=surface.id
    LEFT JOIN surface_revisions published ON published.id=surface.published_revision_id
    WHERE profile.user_id=? AND revision.visibility='private_preview'
      AND (revision.status='draft' OR surface.published_revision_id=revision.id)${revisionFilter}
    ORDER BY revision.revision_number DESC LIMIT 20`);
  const rows = revisionId
    ? await statement.bind(userId, revisionId).all<Record<string, unknown>>()
    : await statement.bind(userId).all<Record<string, unknown>>();

  for (const row of rows.results) {
    try {
      const spec = parseSurfaceSpecJson(String(row.specJson));
      if (
        spec.schemaVersion !== "2" ||
        spec.kind !== "profile" ||
        isHiddenRecoverySurfaceSpec(spec)
      ) {
        continue;
      }
      return {
        surfaceId: String(row.surfaceId),
        revisionId: String(row.revisionId),
        revisionNumber: Number(row.revisionNumber),
        publishedRevisionNumber:
          row.publishedRevisionNumber == null
            ? null
            : Number(row.publishedRevisionNumber),
        governanceVersion: Number(row.governanceVersion),
        alreadyPublished: row.publishedRevisionId === row.revisionId,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function isHiddenRecoverySurfaceSpec(spec: unknown): boolean {
  if (!isRecord(spec)) return false;
  if (spec.title === "Buildmates recovery seed") return true;
  if (spec.title !== "Buildmates page" || !isRecord(spec.root)) return false;
  const manifest = isRecord(spec.bindingManifest) ? spec.bindingManifest : null;
  return (
    spec.root.type === "section" &&
    Array.isArray(spec.root.children) &&
    spec.root.children.length === 2 &&
    manifest !== null &&
    Array.isArray(manifest.content) &&
    manifest.content.length === 2
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
