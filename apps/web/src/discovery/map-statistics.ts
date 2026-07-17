export type MapStatistics = {
  publishedBuilderCount: number;
  mappedBuilderCount: number;
  qualifyingCityCount: number;
  publicProjectCount: number;
  publicTopicCount: number;
  connectionCount: number;
};

type CountRow = { count: number };

export async function getMapStatistics(db: D1Database, qualifyingCities: ReadonlyArray<{ builderCount: number }>): Promise<MapStatistics> {
  const [builders, projects, topics, connections] = await Promise.all([
    db.prepare("SELECT count(*) AS count FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.status='active' AND p.published_at IS NOT NULL").first<CountRow>(),
    db.prepare("SELECT count(*) AS count FROM projects x JOIN users u ON u.id=x.owner_user_id JOIN profiles p ON p.user_id=x.owner_user_id WHERE u.status='active' AND p.published_at IS NOT NULL AND p.audience='public' AND p.cohort_scope_id IS NULL AND x.status='active' AND x.published_at IS NOT NULL AND x.audience='public' AND x.cohort_scope_id IS NULL").first<CountRow>(),
    db.prepare("SELECT count(*) AS count FROM (SELECT pti.taxonomy_item_id FROM project_taxonomy_items pti JOIN projects x ON x.id=pti.project_id JOIN users u ON u.id=x.owner_user_id JOIN profiles p ON p.user_id=x.owner_user_id WHERE pti.kind='topic' AND u.status='active' AND p.published_at IS NOT NULL AND p.audience='public' AND p.cohort_scope_id IS NULL AND x.status='active' AND x.published_at IS NOT NULL AND x.audience='public' AND x.cohort_scope_id IS NULL GROUP BY pti.taxonomy_item_id HAVING count(DISTINCT x.owner_user_id)>=2)").first<CountRow>(),
    db.prepare("SELECT count(*) AS count FROM connections").first<CountRow>(),
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
