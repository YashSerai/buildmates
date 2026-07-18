# Reusable QA scenarios

The authenticated local-only route `/api/testing/qa-scenarios` advances one
test principal through cumulative product scenarios. It is unavailable in
production, requires `BUILDMATES_E2E=1`, requires the E2E header, rejects
non-loopback hosts, enforces same-origin mutations, and scopes every row to the
signed-in test user.

Apply scenarios in this order with `POST { "scenario": "..." }`:

1. `candidate_spectrum` — strong, adjacent, weak, replayed/duplicate, and
   explicitly excluded candidates. Visible candidates populate Introductions;
   the excluded candidate and its private sentinel must never render.
2. `incoming_interest` — a reciprocal proposal requiring the viewer's action.
3. `reciprocal_connection` — exactly one durable Connection and one room.
4. `new_message` — a peer message and unread Activity item.
5. `circle_invitation` — an invitation visible in Circles and Activity.
6. `renewed_relevance` — a public project update from the existing Connection;
   normal Activity materialization creates the notification.
7. `positive_feedback` — useful introduction feedback that makes room tools
   eligible for an explained mutual-approval proposal.
8. `permission_exclusion` — a high-score excluded candidate plus a private
   sentinel field, both of which must remain absent from user-facing output.
9. `no_change` — performs no writes and returns `changed: false` with the same
   digest as the preceding run.

`DELETE /api/testing/qa-scenarios` removes only the deterministic rows created
for the signed-in test principal. It does not reset the person's real profile,
onboarding, settings, or unrelated product state.

The focused browser proof is `tests/e2e/qa-scenarios.spec.ts`. It exercises the
same seeded state through Introductions, Connections, a room, Activity, Circles,
room-upgrade eligibility, privacy exclusion, duplicate replay, and cleanup.
