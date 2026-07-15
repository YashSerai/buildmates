import { createD1Repositories, type RepositoryD1 } from "@buildmates/database";
import { seedDesignPolicy } from "@buildmates/surfaces";

let activeSeed: Promise<void> | null = null;

/** Invoked by the production worker before application routing. Safe per request and isolate. */
export function ensureRuntimeDesignPolicy(DB: D1Database): Promise<void> {
  activeSeed ??= seedDesignPolicy(createD1Repositories(DB as unknown as RepositoryD1)).catch((error) => {
    activeSeed = null;
    throw error;
  });
  return activeSeed;
}

export function resetRuntimeDesignPolicyForTest(): void {
  activeSeed = null;
}
