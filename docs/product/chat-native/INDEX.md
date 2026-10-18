# Buildmates in ChatGPT and Codex

Status: candidate pushed; full CI passed; website version 105 and the existing MCP Worker deployed. Public browser and anonymous protection checks passed within recorded scope. Signed-in, generated-profile quality and actual-host acceptance remain open. Restart from the checkpoint for exact boundaries.

Restart authority: [Current checkpoint](CURRENT.md).

Contract: one canonical Buildmates account and authoritative backend, with conversational access from ChatGPT and Codex. Authentication and consent remain genuine user actions. Generated public profiles and recurring host tasks are optional extensions of signup.

- [Workstream](WORKSTREAM.md): accepted scope and implementation boundaries.
- [Open issues](ISSUES.md): unresolved release work only.
- [Release acceptance plan](QA_PLAN.md): complete journeys and the evidence required at each boundary.
- [Operations](OPERATIONS.md): staged deletion recovery and uncertain idempotency handling.
- [Directory release](DIRECTORY.md): current submission route, discovery research and cost boundaries.
- `qa/`: bounded verification evidence with source, runtime, exclusions, and invalidators.
- [Candidate QA](qa/2026-10-02-candidate.md): consolidated local checks and remaining host boundaries.
- [Expanded QA](qa/2026-10-02-expanded-qa.md): additional edge checks, graded model findings, repairs and fresh browser evidence.
- [Local integration gate (October 2, 2026)](qa/2026-10-02-integration.md): 99 baseline tests passed, followed by final deletion/retry and actor-write checks.
- [ChatGPT/Codex host boundary QA (October 2, 2026)](qa/2026-10-02-chat-plugin-host-boundary.md): local journey results and native-host install evidence.
- Previous assessment: `../2026-10-02-post-hackathon-review.md`.
