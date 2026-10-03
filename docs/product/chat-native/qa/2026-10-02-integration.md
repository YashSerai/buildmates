# Local integration acceptance

Date: October 2, 2026. Source: the codex/chat-native-release working tree, based on 3ba3b985. Runtime: local Miniflare D1 and fixture assets. Production was not changed.

`npm run test:integration` passed **99 tests in 21 files** in 461.69 seconds. The run started at 15:53:47 PDT and used the repository's two-worker configuration.

The account-deletion failures from the earlier run are resolved. The passing suite covers concurrent cleanup, failed object deletion, and all 1,005 owned assets beyond the old row cap. Purges use bounded SQL parameters and record progress; an unfinished purge remains a queued deletion rather than returning a false completion.

A later deletion/reconnect change invalidated that portion of the broad result. Its new focused regression, `account-deletion-reconnect.test.ts`, passed **1 test** after the final source change. It checks pending-request revocation, private-note and invite-redemption removal, archived Circle redaction, and active-account predicates on both connection and room reactivation. The focused test uses a database trigger to exercise the downstream response window.

The final deletion claim change and the existing deletion paths were then checked together with the D1 unknown-outcome receipt cases: **9 tests in 4 files passed**. A failed active-account claim aborts the entire deletion batch before redaction. The profile/project write guards were separately checked with **3 passing D1 tests** for deleted, suspended and active actors, including unchanged handles, profiles, fields, projects and links after rollback and a successful active-account save/publication/project path. The three tests also passed on bundled Node 24.19.0.

The matching suite also verifies reviewed private profiles can participate in introductions while anonymous discovery excludes those profiles. Shortlist refreshes are actor-rate-limited; evaluation reads exclude unrelated participants.

This evidence establishes local deterministic service behavior. It does not establish deployed migrations, provider authentication, actual ChatGPT/Codex conversations, or unattended host tasks. Re-run covered checks after service, schema, migration, dependency, configuration, asset, authentication, or deployment changes.
