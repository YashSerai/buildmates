export type TaxonomyRelationshipKind = "related" | "broader" | "narrower";

export type TaxonomyTerm = { id: string; slug: string; label: string; aliases?: readonly string[] };
export type TopicRelationship = {
  fromTopicId: string;
  toTopicId: string;
  kind: TaxonomyRelationshipKind;
  weightBasisPoints: number;
};

export type MatchingTaxonomy = {
  id: string;
  version: number;
  topics: readonly TaxonomyTerm[];
  tools: readonly TaxonomyTerm[];
  domains: readonly TaxonomyTerm[];
  stages: readonly (TaxonomyTerm & { ordinal: number })[];
  collaborationIntents: readonly TaxonomyTerm[];
  topicRelationships: readonly TopicRelationship[];
};

export function assertValidTaxonomy(taxonomy: MatchingTaxonomy): MatchingTaxonomy {
  if (!Number.isSafeInteger(taxonomy.version) || taxonomy.version < 1) throw new Error("taxonomy_version_invalid");
  const allGroups = [taxonomy.topics, taxonomy.tools, taxonomy.domains, taxonomy.stages, taxonomy.collaborationIntents];
  for (const group of allGroups) {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const term of group) {
      if (!term.id || !term.slug || ids.has(term.id) || slugs.has(term.slug)) throw new Error("taxonomy_term_invalid");
      ids.add(term.id); slugs.add(term.slug);
    }
  }
  const topicIds = new Set(taxonomy.topics.map((topic) => topic.id));
  for (const relation of taxonomy.topicRelationships) {
    if (!topicIds.has(relation.fromTopicId) || !topicIds.has(relation.toTopicId) || relation.fromTopicId === relation.toTopicId) {
      throw new Error("taxonomy_relationship_invalid");
    }
    if (!Number.isInteger(relation.weightBasisPoints) || relation.weightBasisPoints < 0 || relation.weightBasisPoints > 10_000) {
      throw new Error("taxonomy_relationship_weight_invalid");
    }
  }
  return taxonomy;
}
