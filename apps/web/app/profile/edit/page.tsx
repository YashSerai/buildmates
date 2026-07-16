import { requireUser } from "../../../src/auth/require-user";import { ProfileReview } from "../../../components/profile-projects/ProfileReview";
export default async function ProfileEditPage(){await requireUser("/profile/edit");return <main><ProfileReview/></main>}
