# Buildmates build-story ledger

This is the factual source for the eventual Devpost build writeup. It records consequential obstacles, what was tried, what the evidence showed, the product decision, and the honest resolution state. It is not submission copy yet.

## 2026-07-15 — ChatGPT Sites and MCP were not one guaranteed deployment unit

- **Expected:** host the web application and a production Streamable HTTP MCP endpoint together on ChatGPT Sites.
- **Observed:** Sites successfully hosted the vinext web application with D1 and R2, but the available contract did not establish production Streamable HTTP MCP streaming plus OAuth behavior.
- **Decision:** preserve one monorepo but deploy `apps/web` and `apps/mcp` independently. The web app stayed on Sites; the MCP server moved behind the same domain contracts to a Cloudflare Worker.
- **Product consequence:** no domain or matching logic forked. Only deployment, identity delegation, and storage adapters cross the boundary.
- **Resolution:** the Worker is live and its OAuth discovery/protected-resource behavior is smoke-tested; full linked-user tool execution remains gated by website authentication.

## 2026-07-15 — Private Site access did not resolve the saved Google identity

- **Expected:** the custom Sites allowlist entry for `founders@trysoulmate.com` would admit the same saved Google account used by ChatGPT.
- **Observed:** Google completed authentication, but Sites returned `Site not found`. The provider address exposed by Google could not be added as a workspace user, even though it represented the correct founders account.
- **What we tried:** Chrome and the Codex in-app browser, the canonical founders allowlist, the saved Google identity, and an attempted provider-address allowlist entry.
- **Decision:** separate browser/account truth from Sites access-policy truth and test the same flow with user-approved public access.
- **Resolution:** public access removed the `Site not found` boundary, proving the application deployment and account were not the root failure.

## 2026-07-16 — Public Sign in with ChatGPT returned to an anonymous app state

- **Expected:** dispatch-owned `/signin-with-chatgpt` would return a stable authenticated ChatGPT principal to Buildmates.
- **Observed:** the correct founders account completed the callback in two browser surfaces, but `/account` still rendered signed out and `/capability-check` reported no stable authenticated identity.
- **What we ruled out:** a Chrome-only cookie issue, the earlier custom access policy, the wrong Google identity, a failed application deployment, and a D1 readiness failure.
- **Decision:** keep ChatGPT as the only login provider. Do not add GitHub login. Buildmates will map a verified ChatGPT principal to a random internal UUID.
- **Resolution:** unresolved platform capability; the Buildmates-side UUID mapping is planned, but authenticated launch readiness remains unclaimed until the live ChatGPT principal is present.

## 2026-07-16 — Caller-supplied identity headers reached the public application

- **Expected:** the Sites dispatcher would exclusively own and sanitize `oai-authenticated-*` headers before Buildmates trusted them.
- **Observed:** a direct request carrying caller-supplied identity headers reached the application and satisfied the current identity check during the production probe.
- **Why it matters:** hashing a provider subject into a user ID does not establish authenticity. A public application must not let caller-controlled values select an existing user's records.
- **Decision:** replace the deterministic subject hash with a server-side identity mapping and random Buildmates UUID, centralize all protected resolution, reject revoked/deleted principals, and require focused impersonation/isolation proof. This improves the application identity boundary but does not pretend to cryptographically fix a hosting gateway that accepts forged headers.
- **Resolution:** open. The Site must not be described as securely authenticated until the gateway behavior is resolved or an official ChatGPT-only verifiable identity mechanism is available and proven.

## 2026-07-16 — External-login fallback was rejected on product grounds

- **Proposal considered:** GitHub OAuth as a temporary public web identity provider after the SIWC failure.
- **Reason rejected:** it would add a second account system to a product intended to feel native to ChatGPT and Codex, and it would make repository identity unnecessarily central to a broader builder network.
- **Final product rule:** ChatGPT authenticates the person; Buildmates assigns the internal UUID; MCP identity is joined only through the explicit one-time link flow.
- **Resolution:** closed as a product decision. No GitHub login will be implemented.

## Writeup guardrails

- Separate what Buildmates implemented from what was only locally tested, deployed, browser-verified, or still blocked by platform capability.
- Do not turn a platform limitation into a claim that Buildmates solved it.
- Emphasize the architectural response: portable deployment units, deterministic matching without paid inference, explicit identity linking, privacy-safe Work Signals, and a builder network shaped around current work.
- Add only obstacles with direct evidence. Keep dates, exact behavior, chosen fallback, and final state.
