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

- [x] Exact commit `88c6650a0f487b1f2f3608ccd405b7bbbc07d1d1` pushed to the Sites source repository, packaged, saved as version 1, and deployed owner-only at `https://buildmates-network.yashns.chatgpt.site`.
- [x] Owner bypass reaches the deployed vinext application with HTTP 200 and `/api/mcp` returns the intentional external-topology 501 response.
- [ ] Public non-owner reachability for the deployed nested Site.
- [ ] Stable server-verifiable subject from a real non-owner Sign in with ChatGPT session.
- [ ] Two-user object isolation using separate real identities.
- [ ] Provisioned D1 migration plus authenticated insert/read/delete in production.
- [ ] Provisioned R2 authenticated put/read/delete in production.
- [x] Sites packaging resolution of `@buildmates/*` workspace imports.
- [ ] Independent MCP OAuth discovery, redirect registration, PKCE exchange, refresh rotation, revocation, Streamable HTTP initialize, timeout, and reconnect.
- [ ] End-to-end single-use identity link from web subject to opaque MCP subject.

Until those boxes are backed by deployment/browser/runtime artifacts, the selected topology is not production-proven. If Sites cannot meet the web gate, use the prepared Cloudflare/Vercel web adapter. If only MCP fails, keep the web deployment and use `apps/mcp` independently.

### 2026-07-15 owner-only production probe

- Sites project: `appgprj_6a575511bda48191a95bead0c5f48eea`; version 1; deployment `appgdep_6a5755b22f1c8191a09ed8e548c96c93` succeeded.
- In-app Browser had no authenticated OpenAI session. Chrome used its existing saved account, reached Buildmates consent, and returned `Site not found` after the callback. The Site remained active and owner-only, and the bypass route continued returning the app, so this is isolated as an account/access-policy identity check rather than a build/deployment failure.
- The bypass token does not inject a user subject, so protected D1/R2 routes correctly remained 401 and were not misreported as authenticated storage proof.

### 2026-07-15 external MCP deployment and app registration

- The independent Worker is live at `https://buildmates-mcp.yashserai1.workers.dev`. OAuth authorization-server discovery and protected-resource metadata return 200, while unauthenticated Streamable HTTP requests return 401 with the protected-resource metadata URL.
- Cloudflare D1 database `buildmates-mcp` contains only OAuth principals/tokens, one-time authorization handoffs, assertion replay receipts, rate-limit windows, and migration metadata. Canonical profiles, signals, matches, relationships, rooms, Circles, and surfaces remain in the Sites D1 boundary.
- The Worker uses an explicit user-defined OAuth client `buildmates-chatgpt-prod` and the exact ChatGPT callback `https://chatgpt.com/connector/oauth/X9cijyDLeWHf`. A valid authorization request creates a durable one-time handoff and redirects to the Site authorization route. Invalid or malformed authorization requests return a bounded OAuth `invalid_request` response without leaking validation internals.
- ChatGPT developer mode created the real development app `asdk_app_6a57d2ff080481918659b3355a3d9c0e` (version `asdk_app_v_6a57d30111e4819199c0876873b98267`). `plugin/.app.json` is bound to that returned ID; no synthetic identifier was used.
- Sites version 2 packages exact pushed commit `5ecb19200813a99e8670d7a4fd1724e8a127b269` and deployed privately as `appgdep_6a57d4813ff88191ab27b0c3e7360946` with environment revision 1. The deployment contains `/api/identity/mcp-authorization`, `/api/internal/mcp-data`, `/settings/connections`, and the operator recovery surface.
- A real ChatGPT connection started the OAuth flow and reached the signed Site authorization handoff. The available Chrome account still receives the Site access-policy `Site not found` response because the Site is owner-only under a different accessible identity boundary. The Site was deliberately not made public. End-to-end authorization-code exchange and connected tool discovery therefore remain isolated to the private-Site account-access check rather than being claimed as complete.

### 2026-07-16 release-candidate deployment

- GitHub branch `launch/buildmates` contains release commit `2fffa10000d19ae06da433bc2f359b4c0282d369`. That exact commit was also pushed to the private Sites source branch, packaged with migrations 0000-0018, saved as Sites version 3, and deployed successfully as `appgdep_6a58d436b8a881919c216acf097a33c4` at the existing private URL.
- Owner-authorized production smoke returns 200 for the finished landing page, `{"status":"ok"}` from D1-backed `/api/ready`, 200 for robots and the web manifest, and a 307 sign-in redirect for `/home`. CSP includes object and framing denial, `nosniff` is present, and responses carry request IDs. Anonymous access returns 401 at the Sites access-policy boundary because the release remains owner-only.
- The provider-generated production capture was visually inspected. The final editorial field-guide system, work-trail signature, headline, navigation, and CTAs render without desktop clipping or hierarchy defects. Interactive phone production inspection remains pending on successful canonical-account authentication; it does not require a second user.
- The external Worker was redeployed after the shared tool-contract changes as Cloudflare version `0c3f90e3-66ca-486a-a7f4-7d4da6f0becf`. Authorization-server and protected-resource discovery return 200; unauthenticated `/mcp` initialization returns 401 as required. Full PKCE exchange, identity linking, and a linked tool call require one successfully authenticated canonical owner account, not a second user.

### 2026-07-16 canonical owner authentication diagnosis

- Sites access policy revision 2 remains custom and resolves `founders@trysoulmate.com` to account user `98153302-393d-4472-898e-5497f1516100`; the deployment remains active and owner-only.
- Chrome's ChatGPT profile dialog displays `founders@trysoulmate.com`; its correct saved Google provider identity is `founders%trysoulmate.com@gtempaccount.com`. Selecting that saved identity completes Google OAuth, but the Sites callback and a subsequent root request still return `Site not found` before Buildmates code runs. Attempting to add the provider address to the custom allowlist fails with `User 'founders%trysoulmate.com@gtempaccount.com' was not found in this workspace`; the existing canonical founders allowlist remains unchanged at revision 2. The remaining owner-flow boundary is Sites custom-access identity resolution, not Google verification.
- Owner-bypass focused runtime checks remain green: landing 200, D1-backed readiness `{"status":"ok"}`, robots 200, manifest 200, protected `/home` 307 to dispatch-owned SIWC, and unauthenticated MCP initialize 401. These checks do not substitute for an authenticated production subject.
- The current Sites starter contract documents verified email and optional full name, while Buildmates' stable web identity gate requires `oai-authenticated-user-id`. On the first successful canonical callback, `/capability-check` must prove that stable subject before authenticated launch claims; otherwise the documented external identity/hosting fallback is required rather than joining accounts by email.
