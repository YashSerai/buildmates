import path from "node:path";

/**
 * Keep generated QA evidence out of dated historical archives during a run.
 * Ordinary test runs write disposable output. Release checks can opt into a
 * dated evidence directory without overwriting historical proof.
 */
export function qaEvidencePath(...segments: string[]): string {
  const configuredRoot = process.env.BUILDMATES_QA_EVIDENCE_ROOT?.trim();
  const root = configuredRoot || "test-results/qa-evidence";
  return path.resolve(root, ...segments);
}
