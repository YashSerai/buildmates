import {
  aggregateProfilePredicate,
  aggregateProjectPredicate,
} from "./aggregate-eligibility";
import type { AggregateScope } from "./aggregate-eligibility";

export type MapStatistics = {
  publishedBuilderCount: number;
  mappedBuilderCount: number;
  qualifyingCityCount: number;
  publicProjectCount: number;
  publicTopicCount: number;
  connectionCount: number;
};

type CountRow = { count: number };

export async function getMapStatistics(
  db: D1Database,
  qualifyingCities: ReadonlyArray<{ builderCount: number }>,
  options: { scope?: AggregateScope } = {},
): Promise<MapStatistics> {
  const scope = options.scope ?? "public";
  const publicProfileEligibility = aggregateProfilePredicate("p", "u", { scope });
  const publicProjectEligibility = aggregateProjectPredicate("x", "p", "u", { scope });
  const [builders, projects, topics, connections] = await Promise.all([
    db.prepare(`SELECT count(*) AS count FROM profiles p JOIN users u ON u.id=p.user_id WHERE ${publicProfileEligibility}`).first<CountRow>(),
    db.prepare(`SELECT count(*) AS count FROM projects x JOIN profiles p ON p.user_id=x.owner_user_id JOIN users u ON u.id=x.owner_user_id WHERE ${publicProjectEligibility}`).first<CountRow>(),
    // Profile topic contributions are canonical matching context and carry
    // no public-audience proof. Anonymous aggregates therefore count only
    // taxonomy attached to an explicitly public project.
    db.prepare(`SELECT count(DISTINCT topic_id) AS count FROM (
      SELECT pti.taxonomy_item_id AS topic_id
      FROM project_taxonomy_items pti
      JOIN projects x ON x.id=pti.project_id
      JOIN profiles p ON p.user_id=x.owner_user_id
      JOIN users u ON u.id=x.owner_user_id
      WHERE pti.kind='topic' AND ${publicProjectEligibility}
    )`).first<CountRow>(),
    db.prepare(`SELECT count(*) AS count
      FROM connections c
      WHERE c.state='active'
        AND 2=(
          SELECT count(*)
          FROM connection_sides cs
          JOIN profiles p ON p.user_id=cs.user_id
          JOIN users u ON u.id=cs.user_id
          WHERE cs.connection_id=c.id AND ${publicProfileEligibility}
        )`).first<CountRow>(),
  ]);
  return {
    publishedBuilderCount: Number(builders?.count ?? 0),
    mappedBuilderCount: qualifyingCities.reduce((total, city) => total + Math.max(0, Math.floor(city.builderCount)), 0),
    qualifyingCityCount: qualifyingCities.length,
    publicProjectCount: Number(projects?.count ?? 0),
    publicTopicCount: Number(topics?.count ?? 0),
    connectionCount: Number(connections?.count ?? 0),
  };
}
