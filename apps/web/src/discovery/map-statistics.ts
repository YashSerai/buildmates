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
    db.prepare("SELECT count(*) AS count FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.status='active'").first<CountRow>(),
    db.prepare("SELECT count(*) AS count FROM projects x JOIN users u ON u.id=x.owner_user_id WHERE u.status='active' AND x.status='active'").first<CountRow>(),
    db.prepare("SELECT count(DISTINCT topic_id) AS count FROM (SELECT pti.taxonomy_item_id AS topic_id FROM project_taxonomy_items pti JOIN projects x ON x.id=pti.project_id JOIN users u ON u.id=x.owner_user_id WHERE pti.kind='topic' AND u.status='active' AND x.status='active' UNION ALL SELECT c.topic_id FROM profile_topic_contributions c JOIN users u ON u.id=c.user_id WHERE u.status='active' UNION ALL SELECT topic.value FROM work_signals w JOIN users u ON u.id=w.user_id JOIN json_each(w.canonical_topic_ids_json) topic WHERE u.status='active' AND w.approved_at IS NOT NULL AND w.revoked_at IS NULL AND w.expires_at>CAST(strftime('%s','now') AS INTEGER)*1000)").first<CountRow>(),
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
