# Candidate QA

Date: October 2, 2026 in America/Vancouver. Application source: `d1c212207c0d080cc00cabf6e0fa04054a6e631b` on `codex/chat-native-release`, based on `3ba3b985`. The subsequent `895d85d` change corrects a screenshot date label only. Evidence covers local source, Miniflare D1/assets, Chromium interactions and a fixture MCP Apps bridge. Production is unchanged.

| Gate | Result | Boundary |
| --- | --- | --- |
| Unit | 121 passed | Local code, including OAuth and migration helpers |
| Integration | 99 passed across 21 files | Canonical services, D1 and asset fixtures |
| Chat contract | 97 passed across 12 files | Routing, authority, confirmation, privacy, pagination, retry and rendering |
| Security | 23 passed | Local authorization and generated-content safeguards |
| Web | 22 passed | Server render and source behavior; repeated after final interface changes |
| Type checks, lint and production build | Passed | All seven workspaces; local build only |
| Browser | 88 distinct local cases validated; two deployed captures excluded | Broad run followed by affected final rechecks |
| Portable manifests | Four valid | Live official 1.0.0 schemas, canonical package and beta mirror |
| Package | Passed | Deterministic 10-file ZIP, four skills |
| Embedded workspace | Passed at 390px and 1440px | Service-shaped fixture bridge, keyboard, status gates, retry, isolated preview and overflow checks |

The broad 90-case browser run passed 84, failed four and skipped two deployed captures. The final affected 34-case run passed 31, failed one script-loading readiness assertion and skipped the same two captures. The last four-case regression passed on desktop and phone after waiting for the held document's scripts to finish loading and correcting closed-section locators. Combined evidence covers all 88 local cases. It is not a single final full-suite result.

Those regressions exercise invalid save acknowledgements, failed network retries, retained drafts, disabled controls before hydration, independent accounts, actual phone viewports, reciprocal introductions, room messages, Circle invitation/governance, entry creation/edit/deletion, project collaboration/ownership and outsider isolation. Review repaired a native GET fallback that could place draft fields in the URL. The profile form now uses POST semantics and stays disabled until its client handler is ready.

Final backend changes passed a focused nine-test deletion/retry bundle and three D1 active/inactive-actor write tests. Independent review checked the actual NOT NULL constraints, batch rollback, deletion claim, replay receipts and normalized API acknowledgement. The three actor-write tests passed on Node 24.19.0.

The broad unit/integration/contract/security gates used machine Node 20.17.0 and npm 10.8.2. Final workspace type checks, lint, build, web tests, browser checks and actor-write tests used bundled Node 24.19.0. The repository declares Node >=22.13 and npm 11.6.0; committed remote CI targets Node 22/npm 11.6.0 and has not run.

The retained page catalog has 102 latest screenshot rows, zero page errors and zero recorded failed requests. Six signed-out protected captures reached the unconfigured local provider handoff and remain `review`; the recorded HTTP 503/404 console messages are retained. Their real authentication behavior must be checked after deployment. Folder names containing July dates are legacy test labels. CSV execution dates were corrected from screenshot file timestamps in UTC, and the capture source now uses the actual UTC date. No raw credentials or traces are committed.

Package: `dist/buildmates-plugin-0.4.0.zip`. SHA-256: `6D925DCCFAE19DD52511E832DE0AA67143B8780DBFB10EE2A1C810F5B53407FE`. It still targets the existing live endpoint and does not deploy this backend.

The build completed with the existing visualization chunk-size warning and framework route-classification limitation. Actual host installation, provider consent, fresh natural-language conversations, two independent human accounts, deployed migration/version parity, cleanup/recovery coverage, remote CI and public review remain unverified. Background execution remains unavailable until a genuine adapter proves it.

Re-run covered checks after changes to source, schemas, migrations, dependencies, configuration, authentication, assets, host protocol or deployments. Documentation-only changes do not invalidate application checks.
