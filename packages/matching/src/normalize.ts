import type { MatchingTaxonomy, TaxonomyTerm } from "./taxonomy";

export function normalizeTaxonomyText(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function termLookup(terms: readonly TaxonomyTerm[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const term of terms) {
    for (const value of [term.id, term.slug, term.label, ...(term.aliases ?? [])]) result.set(normalizeTaxonomyText(value), term.id);
  }
  return result;
}

export function canonicalizeTerms(values: readonly string[], terms: readonly TaxonomyTerm[]): string[] {
  const lookup = termLookup(terms);
  return [...new Set(values.map((value) => lookup.get(normalizeTaxonomyText(value))).filter((value): value is string => Boolean(value)))].sort();
}

export function canonicalizeBuilderTerms(input: {
  taxonomy: MatchingTaxonomy;
  topics?: readonly string[];
  tools?: readonly string[];
  domains?: readonly string[];
  stages?: readonly string[];
  intents?: readonly string[];
}) {
  return {
    topics: canonicalizeTerms(input.topics ?? [], input.taxonomy.topics),
    tools: canonicalizeTerms(input.tools ?? [], input.taxonomy.tools),
    domains: canonicalizeTerms(input.domains ?? [], input.taxonomy.domains),
    stages: canonicalizeTerms(input.stages ?? [], input.taxonomy.stages),
    intents: canonicalizeTerms(input.intents ?? [], input.taxonomy.collaborationIntents),
  };
}
