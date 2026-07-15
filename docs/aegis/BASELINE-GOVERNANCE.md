# Baseline Governance

## Truth layers

Buildmates tracks four kinds of truth independently:

1. Source-control truth: what exists in the committed repository.
2. deployment truth: what the hosting provider reports as deployed.
3. browser truth: what a user can load and interact with.
4. runtime truth: what authenticated data, permissions, automations, and integrations actually do.

Passing one layer does not imply the others passed.

## Evidence rules

- Product capability claims require a reproducible test or captured browser/runtime evidence.
- External platform claims require current official documentation or a direct platform test.
- Inferred behavior is labeled as an inference until verified.
- Test fixtures and seeded demo users are labeled; they are never presented as real adoption.
- No invented metrics, testimonials, partners, customers, or usage claims appear in product UI or submission materials.

## Scope-change rules

A change to a non-negotiable product rule requires all of the following:

1. Record the reason and affected user flow in the product specification.
2. Update `BUILD_INDEX.md` and the implementation plan.
3. Identify privacy, security, accessibility, operational, and migration effects.
4. Re-run affected acceptance tests.

New features may extend scope but may not silently weaken reciprocal consent, privacy controls, authorization, or generative-surface governance.

## Architecture-decision rules

ChatGPT Sites remains the preferred web host until a measured launch-validation check fails or its limits prevent the production contract. `GOAL.md` pre-authorizes the primary implementation thread to activate the prepared Cloudflare/Vercel adapter without returning for an ordinary architecture choice. The recorded architecture decision must include:

- the failing capability or measured limit;
- data and identity migration steps;
- cost and operational consequences;
- rollback path;
- compatibility test results.

## Design-policy rules

The canonical Codex-wide design law lives at `C:\Users\yashs\.codex\guides\anti-slop-design-law.md`. Buildmates maintains a runtime, product-specific Design Policy derived from it. The repository owns the policy source; D1 stores deployed versioned copies. Generated profiles, rooms, and Circles must record the policy version used.

The policy can become stricter without invalidating old surfaces. A breaking policy change triggers regeneration review, not automatic replacement of shared surfaces.

## Release gates

A release cannot be called complete until:

- lint, type checks, unit tests, integration tests, and migrations pass;
- authorization and reciprocal-matching attack cases pass;
- accessibility and reduced-motion checks pass;
- phone and desktop rendered states have been inspected;
- empty, loading, error, stale, deleted, and permission-denied states are present;
- rollback exists for data migrations and generated surface revisions;
- public deployment has a smoke test distinct from local checks.
