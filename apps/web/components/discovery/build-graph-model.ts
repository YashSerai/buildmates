import type { BuildGraphEdge, BuildGraphRelationship, BuildGraphTopic } from "../../src/discovery/service";

export type TopicGraphModel = ReturnType<typeof createTopicGraphModel>;

export function createTopicGraphModel(topics: BuildGraphTopic[], relationships: BuildGraphRelationship[]) {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const parentById = new Map<string, string>();
  const childrenById = new Map<string, string[]>();
  for (const relationship of relationships) {
    if (!topicById.has(relationship.parentId) || !topicById.has(relationship.childId)) continue;
    parentById.set(relationship.childId, relationship.parentId);
    childrenById.set(relationship.parentId, [...(childrenById.get(relationship.parentId) ?? []), relationship.childId]);
  }
  const roots = topics.filter((topic) => !parentById.has(topic.id)).sort(topicOrder);
  for (const [id, children] of childrenById) {
    childrenById.set(id, [...new Set(children)].sort((a, b) => topicOrder(topicById.get(a)!, topicById.get(b)!)));
  }
  const rootFor = (id: string) => {
    let current = id;
    const seen = new Set<string>();
    while (parentById.has(current) && !seen.has(current)) {
      seen.add(current);
      current = parentById.get(current)!;
    }
    return current;
  };
  const pathTo = (id: string) => {
    const path: BuildGraphTopic[] = [];
    let current: string | undefined = id;
    const seen = new Set<string>();
    while (current && topicById.has(current) && !seen.has(current)) {
      seen.add(current);
      path.unshift(topicById.get(current)!);
      current = parentById.get(current);
    }
    return path;
  };
  return { topicById, parentById, childrenById, roots, rootFor, pathTo };
}

export function strongestNeighbors(topicId: string, edges: BuildGraphEdge[], limit = 5) {
  return edges
    .filter((edge) => edge.sourceId === topicId || edge.targetId === topicId)
    .sort((a, b) => b.builderCount - a.builderCount || b.contributionCount - a.contributionCount)
    .slice(0, limit)
    .map((edge) => ({ id: edge.sourceId === topicId ? edge.targetId : edge.sourceId, shared: edge.builderCount }));
}

export function topicOrder(a: BuildGraphTopic, b: BuildGraphTopic) {
  return b.builderCount - a.builderCount || b.contributionCount - a.contributionCount || a.label.localeCompare(b.label);
}

export const CATEGORY_COLORS = ["#a9bc91", "#d09a63", "#7ea49a", "#d7c79d", "#83966f", "#c47b5a", "#91a9bd", "#b1a17f"];
