import { ProjectEditor } from "../../../components/profile-projects/ProjectEditor";
import { requireUser } from "../../../src/auth/require-user";
import { getPlatformBindings } from "../../../src/platform/bindings";
import { listProjectTaxonomyChoices } from "../../../src/profile-projects/service";
export default async function NewProjectPage(){const[,{DB}]=await Promise.all([requireUser("/projects/new"),getPlatformBindings()]);return <main><ProjectEditor taxonomyChoices={await listProjectTaxonomyChoices(DB)}/></main>}
