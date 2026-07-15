import { asUserId, type BuildmatesRepositories, type CohortId, type Profile } from "@buildmates/domain";

export const FIXTURE_NOTICE = "Fictional Buildmates validation fixture. Not a product metric or real endorsement.";
export const fixtureUsers = [
  { id: asUserId("fixture_aya"), status: "active", operatorRole: "none", createdAt: new Date("2026-07-14T00:00:00Z") },
  { id: asUserId("fixture_milo"), status: "active", operatorRole: "none", createdAt: new Date("2026-07-14T00:00:00Z") },
] as const;
export const fixtureProfiles: readonly Profile[] = [
  { id: "profile_fixture_aya" as Profile["id"], userId: fixtureUsers[0].id, handle: "aya-builds", displayName: "Aya (fixture)", summary: "Fictional builder exploring retrieval evaluation for local-first tools.", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" },
  { id: "profile_fixture_milo" as Profile["id"], userId: fixtureUsers[1].id, handle: "milo-makes", displayName: "Milo (fixture)", summary: "Fictional builder prototyping accessible voice interfaces.", audience: "public", cohortScopeId: null, allowMatching: true, acceptanceMode: "manual" },
];
export const buildWeekFixture = { id: "cohort_build_week_2026" as CohortId, slug: "openai-build-week-2026", name: "OpenAI Build Week 2026", description: "Community-created validation cohort fixture.", visibility: "public" as const, governanceVersion: 1, communityCreated: true } as const;

export async function seedRepositoryFixtures(repositories: BuildmatesRepositories): Promise<void> {
  for (const user of fixtureUsers) await repositories.users.create({ ...user });
  for (const profile of fixtureProfiles) await repositories.profiles.create({ ...profile, actorId: profile.userId });
  await repositories.cohorts.create({ ...buildWeekFixture, actorId: fixtureUsers[0].id });
}
