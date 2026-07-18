import { ProjectEditor } from "../../../components/profile-projects/ProjectEditor";
import { ProductHeader } from "../../../components/discovery/ProductHeader";
import { requireUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { listProjectTaxonomyChoices } from "../../../src/profile-projects/service";
import styles from "../../profile-projects.module.css";

export default async function NewProjectPage() {
  const [, { DB }] = await Promise.all([
    requireUser("/projects/new"),
    getPlatformBindings(),
  ]);

  return (
    <>
      <ProductHeader signedIn />
      <main className={styles.projectWorkspace}>
        <ProjectEditor
          cancelHref="/profile"
          taxonomyChoices={await listProjectTaxonomyChoices(DB)}
        />
      </main>
    </>
  );
}
