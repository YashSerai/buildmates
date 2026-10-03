/** Reuse the repository's canonical migration helper so QA cannot drift from tests. */
export { applyD1Migrations, applyD1Statements, splitD1MigrationSql } from "../../tests/helpers/migrate-d1";
