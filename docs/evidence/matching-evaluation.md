# Deterministic matching evaluation

Buildmates version 1 matching performs no production model call and uses no embeddings. The committed scorer is a reproducible candidate-retrieval layer; each user's Codex evaluates the bounded, privacy-filtered shortlist independently.

## Contract

- Taxonomy version: fixture version 1; production taxonomy IDs are validated by D1.
- Weight version: `MATCH_WEIGHT_VERSION = 1`.
- Shortlist: at most 30 candidates.
- Eligibility precedes scoring: pause, expiry, taxonomy mismatch, self, blocks, user exclusions, and matching exclusions fail closed.
- Components: current topic overlap and adjacency, tool/domain fit, stage, current intent, optional offer/need complementarity, location, timezone, cohort, freshness, confidence, prior decline, cluster repetition, and bounded serendipity.
- Privacy: viewer explanations expose only currently authorized evidence IDs. Hidden evidence is represented only by a non-revealing boolean and never returned as content.
- Reciprocal consent: two independent Codex approvals are always required. A manual side additionally requires Interested. Full Autopilot substitutes for that person's tap only when its capability is proven and matching is not paused.

## Fictional evaluation set

The committed fixtures cover exact overlap, taxonomy adjacency, vocabulary aliases, borderline serendipity, explicit exclusion, and blocked pairs. Unit tests also cover stable ordering, the top-30 cap, private evidence, expiry, pause, stale taxonomy, all four Manual/Full Autopilot combinations, unavailable-autopilot fallback, undo-before-open, stale evaluations, decline, and expiry.

No fixture uses sensitive traits. Offers and needs are optional and carry less weight than mutual current-work and intent relevance.

## Current proof

Run:

```powershell
npx vitest run tests/unit/matching-score.test.ts tests/unit/match-state-machine.test.ts
npm run typecheck --workspace @buildmates/matching
```

The first calibration is intentionally conservative. Production weight changes require a new immutable weight version and measured results against labeled fixtures; they do not change reciprocal-consent rules.
