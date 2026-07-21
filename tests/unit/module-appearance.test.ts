import { describe, expect, it } from "vitest";
import { DEFAULT_MODULE_APPEARANCE, safeParseModuleAppearance } from "@buildmates/surfaces";

describe("shared tool appearance", () => {
  it("accepts distinct approved functional layouts", () => {
    for (const layout of ["ledger", "cards", "timeline", "showcase"] as const) {
      expect(safeParseModuleAppearance({
        ...DEFAULT_MODULE_APPEARANCE,
        concept: { source: "imagegen", direction: "An approved functional experiment workspace with visible states.", referenceLabel: "Experiment board concept", approvedByUser: true },
        layout,
      }).success).toBe(true);
    }
  });

  it("rejects unapproved concepts and inaccessible token pairs", () => {
    expect(safeParseModuleAppearance({
      ...DEFAULT_MODULE_APPEARANCE,
      concept: { ...DEFAULT_MODULE_APPEARANCE.concept, approvedByUser: false },
    }).success).toBe(false);
    const lowContrast = safeParseModuleAppearance({
      ...DEFAULT_MODULE_APPEARANCE,
      tokens: { ...DEFAULT_MODULE_APPEARANCE.tokens, text: "#eeeeee", mutedText: "#eeeeee", surface: "#ffffff" },
    });
    expect(lowContrast.success).toBe(false);
    if (!lowContrast.success) expect(lowContrast.error.issues.some((issue) => issue.path.join(".") === "tokens.text")).toBe(true);
  });

  it("rejects arbitrary appearance fields instead of treating them as behavior", () => {
    expect(safeParseModuleAppearance({ ...DEFAULT_MODULE_APPEARANCE, script: "fetch('/private')" }).success).toBe(false);
  });
});
