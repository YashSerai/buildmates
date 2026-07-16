import { requireUser } from "../../../src/auth/require-user";import { ProjectEditor } from "../../../components/profile-projects/ProjectEditor";
export default async function NewProjectPage(){await requireUser("/projects/new");return <main><ProjectEditor/></main>}
