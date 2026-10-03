# Current checkpoint

Updated: October 3, 2026.

Active phase: release preparation on `codex/chat-native-release`. Implementation commit `876778b` and the Linux CSS dependency repair `0245791` are pushed. Website version 104 is saved with an archive, but not deployed. The existing production website, MCP worker and public listings remain unchanged.

Remote Node 22 lint, all workspace type checks, all 394 deterministic checks and builds passed on `0245791`. Its browser gate passed 96 cases, skipped two and failed four. Three failures concerned the landing-page setup trigger; the fourth concerned the phone design-workspace fixture. The October 3 hydration notification and responsive fixture repairs passed all six targeted Chromium desktop/phone cases locally. The complete remote gate must pass on these repairs before deployment. [Earlier CI run](https://github.com/YashSerai/buildmates/actions/runs/37095792198)

Verification combines the complete 379-check gate with affected repair rechecks, covering 394 deterministic checks. The final backend batch passed 60/60; the last concurrency/collision checks passed 3/3 and a five-case sanity recheck passed. The affected app browser gate passed 38/38 and standalone widget edges passed 6/6. Repository lint, all seven workspace type checks and builds passed on supported Node 24; focused checks and web/MCP-core builds were repeated after the last changes. [Expanded QA](qa/2026-10-02-expanded-qa.md) records exact scope, failures, exclusions and invalidators. [Source manifest](qa/2026-10-02-expanded-manifest.json) records the baseline revision, final file hashes and package hash.

GPT-6 Luna at high reasoning used the twelve-conversation allowance: three native-tool infrastructure failures, eight baseline proxy conversations and one fresh repair proxy conversation. Nine actual proxy conversations contain 44 turns. Original failures remain in [independent grades](qa/2026-10-02-conversation-grades.json); selected same-actor repair turns scored 14/14 after workflow reload. Complete fresh-context journeys on the final candidate remain a release gate.

Package: `dist/buildmates-plugin-0.4.0.zip`, SHA-256 `27C48551A4268074D9398209906D4AC3FBC8A3EC0DA1FE8111A091FEEBE104F8`. Four skills and ten package files validated; canonical and beta copies agree. October 3 metadata includes the packaged onboarding skill and factual release notes. The ZIP targets the existing live endpoint, which this work has not upgraded. The earlier expanded-QA manifest retains its historical package hash.

The user approved push/deployment with no new spending. The existing Cloudflare Workers plan was verified Free ($0), the existing MCP database has no pending migrations, and website hosting remains on the same Sites project. Keep these services and plans. No further paid model tests are authorized. [Directory research](DIRECTORY.md) recommends the shared ChatGPT/Codex plugin route and records remaining owner/dashboard requirements.

Next acceptance phase: finish the browser gate, deploy the same reviewed web/MCP candidate with additive website migrations, verify protected live boundaries, then complete operator recovery coverage and actual installation/OAuth in both hosts with two consenting independent human accounts. Background execution stays unavailable until a genuine host adapter proves it. Fresh-context model journeys and public review remain open.

Restart here, then read Expanded QA and [Open issues](ISSUES.md). Re-run evidence only after a covered source, schema, dependency, configuration, authentication, asset, skill, host or deployment change.
