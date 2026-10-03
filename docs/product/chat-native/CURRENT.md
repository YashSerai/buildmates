# Current checkpoint

Updated: October 2, 2026.

Active phase: expanded local QA and repairs complete on `codex/chat-native-release`. Production, real accounts and public listings are unchanged. Nothing has been pushed, deployed or installed by this phase.

Verification combines the complete 379-check gate with affected repair rechecks, covering 394 deterministic checks. The final backend batch passed 60/60; the last concurrency/collision checks passed 3/3 and a five-case sanity recheck passed. The affected app browser gate passed 38/38 and standalone widget edges passed 6/6. Repository lint, all seven workspace type checks and builds passed on supported Node 24; focused checks and web/MCP-core builds were repeated after the last changes. [Expanded QA](qa/2026-10-02-expanded-qa.md) records exact scope, failures, exclusions and invalidators. [Source manifest](qa/2026-10-02-expanded-manifest.json) records the baseline revision, final file hashes and package hash.

GPT-6 Luna at high reasoning used the twelve-conversation allowance: three native-tool infrastructure failures, eight baseline proxy conversations and one fresh repair proxy conversation. Nine actual proxy conversations contain 44 turns. Original failures remain in [independent grades](qa/2026-10-02-conversation-grades.json); selected same-actor repair turns scored 14/14 after workflow reload. Complete fresh-context journeys on the final candidate remain a release gate.

Package: `dist/buildmates-plugin-0.4.0.zip`, SHA-256 `B0458797E5D424FD5757D641A0F39FDE5FD9C78DCA6F95EDBB3BD40F8C35326E`. Four skills and ten package files validated; canonical and beta copies agree. The ZIP targets the existing live endpoint, which this work has not upgraded.

Next acceptance phase: candidate deployment approval, operator cleanup/recovery coverage, deployed migrations and web/MCP version parity, actual installation and OAuth in both hosts, then fresh journeys with two consenting independent human accounts. Background execution stays unavailable until a genuine host adapter proves it. Remote Node 22 CI and public review remain open.

Restart here, then read Expanded QA and [Open issues](ISSUES.md). Re-run evidence only after a covered source, schema, dependency, configuration, authentication, asset, skill, host or deployment change.
