import type { BuildmatesRepositories } from "@buildmates/domain";
import {
  DESIGN_POLICY_ACTIVATED_AT,
  DESIGN_POLICY_ID,
  DESIGN_POLICY_SOURCE,
  DESIGN_POLICY_SOURCE_HASH,
  DESIGN_POLICY_VERSION,
} from "./design-policy";

export async function seedDesignPolicy(
  repositories: Pick<BuildmatesRepositories, "surfaces">,
): Promise<void> {
  const activatedAt = new Date(DESIGN_POLICY_ACTIVATED_AT);
  await repositories.surfaces.createPolicy({
    id: DESIGN_POLICY_ID,
    version: DESIGN_POLICY_VERSION,
    sourceHash: DESIGN_POLICY_SOURCE_HASH,
    policyJson: DESIGN_POLICY_SOURCE,
    activatedAt,
    at: activatedAt,
  });
}
