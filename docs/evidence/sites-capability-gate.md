# Sites capability gate

Date: 2026-07-15

This file separates local contract evidence from deployment and production-runtime evidence. A checked local item is not a claim that ChatGPT Sites has provisioned or exposed the capability.

## Local source and contract evidence

- [x] `apps/web` remains the nested Sites/vinext deployment unit and imports shared workspace packages.
- [x] `.openai/hosting.json` declares only logical `DB` (D1) and `ASSETS` (R2) bindings; it contains no resource IDs or credentials.
- [x] D1 and R2 diagnostic adapters perform scoped write/read/delete cleanup and return no actor identifier or secret.
- [x] Capability routes require a stable platform subject and reject anonymous calls.
- [x] Link codes use cryptographic randomness, SHA-256 at rest, a ten-minute expiry, one-use consumption fields, and issuance/attempt limits.
- [x] External delegation validates signed issuer, audience, opaque MCP subject, JTI, issued/expiry times, action, and scope; replay IDs are durable.
- [x] The internal data route is absent (`404`) unless `MCP_TOPOLOGY=external`, rejects any caller-supplied `userId`, and resolves the active MCP link itself.
- [x] `packages/mcp-core` owns the sole registry. Before linking it exposes only OAuth-authenticated `get_link_url` and rate-limited `complete_identity_link`; neither returns user data.
- [x] The Sites MCP route returns an explicit `501` because Streamable HTTP plus OAuth has not been proven in Sites. It does not advertise a fake MCP service.
- [x] The independent MCP adapter serves OAuth discovery, authorization-code + S256 PKCE, token, refresh, revocation, protected-resource metadata, and token-authenticated Streamable HTTP through one durable D1 store.
- [x] Web-to-MCP authorization uses a stable web provider subject, a signed two-minute assertion, one-time D1 handoff state, replay protection, and an MCP-origin HttpOnly cookie. Email and display name are not inputs.
- [x] A real local D1 suite proves concurrent link-code single use, web/MCP convergence, PKCE, authorization-code and refresh replay rejection, audience enforcement, token-family revocation, and Alice/Bob private-record isolation.

## Environment contract

| Variable | Runtime | Purpose |
| --- | --- | --- |
| `MCP_TOPOLOGY=external` | web | Enables the otherwise absent delegated-data route. |
| `MCP_DELEGATION_PUBLIC_KEY_PEM` | web | RS256 verification public key; never the signing key. |
| `MCP_DELEGATION_ISSUER` | web | Expected assertion issuer; defaults to `buildmates-mcp`. |
| `MCP_DELEGATION_AUDIENCE` | web | Expected assertion audience; defaults to `buildmates-web-data`. |
| signing private key and key ID | independent MCP secret store | Signs 60-second delegated assertions; never committed or sent to the web as configuration. |
| `MCP_OAUTH_BASE_URL` | web | Exact external MCP origin allowed for the signed authorization callback. |
| `MCP_WEB_AUTHORIZATION_PRIVATE_KEY_PEM` | web secret store | Signs short-lived stable-subject authorization assertions. |
| `MCP_WEB_AUTHORIZATION_ISSUER`, `MCP_WEB_AUTHORIZATION_AUDIENCE`, `MCP_WEB_AUTHORIZATION_KEY_ID` | web | Pins authorization assertion claims and rotation key ID. |
| `OAUTH_ISSUER`, `MCP_RESOURCE`, `OAUTH_CLIENTS_JSON` | independent MCP | OAuth issuer/resource URLs and registered client redirect allowlist. |
| `OAUTH_SUBJECT_SECRET` | independent MCP secret store | Derives stable opaque MCP subjects from issuer, subject, and client; never from email. |
| `WEB_AUTHORIZATION_PUBLIC_KEY_PEM`, `WEB_AUTHORIZATION_ISSUER`, `WEB_AUTHORIZATION_AUDIENCE` | independent MCP | Verifies the signed web handoff assertion and cookie. |

## Live evidence still required

- [ ] Public non-owner reachability for the deployed nested Site.
- [ ] Stable server-verifiable subject from a real non-owner Sign in with ChatGPT session.
- [ ] Two-user object isolation using separate real identities.
- [ ] Provisioned D1 migration plus authenticated insert/read/delete in production.
- [ ] Provisioned R2 authenticated put/read/delete in production.
- [ ] Sites packaging resolution of `@buildmates/*` workspace imports.
- [ ] Independent MCP OAuth discovery, redirect registration, PKCE exchange, refresh rotation, revocation, Streamable HTTP initialize, timeout, and reconnect.
- [ ] End-to-end single-use identity link from web subject to opaque MCP subject.

Until those boxes are backed by deployment/browser/runtime artifacts, the selected topology is not production-proven. If Sites cannot meet the web gate, use the prepared Cloudflare/Vercel web adapter. If only MCP fails, keep the web deployment and use `apps/mcp` independently.
