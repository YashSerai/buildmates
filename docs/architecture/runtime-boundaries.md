# Runtime Boundaries

Buildmates is one monorepo with independently deployable web and MCP units.

- `apps/web` owns browser routes, public/authenticated APIs, the in-app inbox, rendering, and the authoritative data boundary.
- `apps/mcp` is the external Streamable HTTP adapter when MCP cannot co-deploy with the Site.
- `packages/mcp-core` owns one transport-independent tool registry shared by thin deployment adapters.
- `packages/domain` owns entities, policies, state machines, authorization contracts, and validation.
- `packages/database` owns schemas and repositories.
- `packages/matching` owns taxonomy, indexing, deterministic scores, and reciprocal state.
- `packages/surfaces` owns the GeneratedSiteBundle v3 HTML/CSS envelope for profiles, legacy shared-surface primitives, sanitization, and design policy.

ChatGPT Sites is the preferred web host. A measured incompatibility activates the prepared Cloudflare/Vercel adapter under `GOAL.md`; it does not fork domain behavior. External MCP requests carry a short-lived signed OAuth subject and never an internal user ID chosen by the caller.

MCP first attempts a thin co-deployed Sites adapter backed by the same `packages/mcp-core` registry. If Sites cannot prove Streamable HTTP, OAuth, timeout, and reconnect behavior, `apps/mcp` deploys to a Cloudflare Worker or Vercel and calls the web-owned data authority through signed subject delegation. This fallback is automatic. Execution pauses only for an irreducible human/account action such as unavailable second-account approval, CAPTCHA/2FA, owner-only permission, or missing credential/billing authority.
