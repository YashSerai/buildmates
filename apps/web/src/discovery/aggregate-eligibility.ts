/** SQL predicates shared by the anonymous aggregate surfaces. */
export type AggregateScope = "public" | "qa_fixture_preview";

type AggregatePredicateOptions = {
  requireMapOptIn?: boolean;
  scope?: AggregateScope;
};

export function aggregateProfilePredicate(
  profileAlias = "p",
  userAlias = "u",
  options: AggregatePredicateOptions = {},
) {
  const scope = options.scope ?? "public";
  if (scope === "qa_fixture_preview") {
    const clauses = [`${userAlias}.status='active'`, `${userAlias}.data_origin='qa_fixture'`];
    if (options.requireMapOptIn) clauses.push(`${profileAlias}.location_map_opt_in=1`);
    return clauses.join(" AND ");
  }
  const clauses = [
    `${userAlias}.status='active'`,
    `${userAlias}.data_origin='live'`,
    `${profileAlias}.published_at IS NOT NULL`,
    `${profileAlias}.audience='public'`,
    `${profileAlias}.cohort_scope_id IS NULL`,
  ];
  if (options.requireMapOptIn) clauses.push(`${profileAlias}.location_map_opt_in=1`);
  return clauses.join(" AND ");
}

export function aggregateProjectPredicate(
  projectAlias = "x",
  profileAlias = "p",
  userAlias = "u",
  options: AggregatePredicateOptions = {},
) {
  return [
    aggregateProfilePredicate(profileAlias, userAlias, options),
    `${projectAlias}.status='active'`,
    `${projectAlias}.deleted_at IS NULL`,
    ...(options.scope === "qa_fixture_preview"
      ? []
      : [
          `${projectAlias}.published_at IS NOT NULL`,
          `${projectAlias}.audience='public'`,
          `${projectAlias}.cohort_scope_id IS NULL`,
        ]),
  ].join(" AND ");
}

export function publicAggregateProfilePredicate(
  profileAlias = "p",
  userAlias = "u",
  options: Omit<AggregatePredicateOptions, "scope"> = {},
) {
  return aggregateProfilePredicate(profileAlias, userAlias, { ...options, scope: "public" });
}

export function publicAggregateProjectPredicate(
  projectAlias = "x",
  profileAlias = "p",
  userAlias = "u",
  options: Omit<AggregatePredicateOptions, "scope"> = {},
) {
  return aggregateProjectPredicate(projectAlias, profileAlias, userAlias, { ...options, scope: "public" });
}
