# Buildmates Initial Baseline — 2026-07-14

## Workspace state

- Workspace: `C:\Users\yashs\OneDrive\Desktop\Yash Stuff\TECHTOK\Buildmates`
- Git repository: initialized on `main`, with no project commit at planning time.
- Application starter: ChatGPT Sites vinext starter using Next.js 16, React 19, a Cloudflare Worker runtime, D1/Drizzle scaffolding, and Sign in with ChatGPT helpers.
- Hosting configuration: `.openai/hosting.json` exists; D1 and R2 resource IDs are not yet assigned.
- Database schema: starter only; Buildmates entities are not implemented.
- Product implementation: not started.
- GitHub remote: not created or connected.
- Production deployment: not created.

Generated starter directories such as `node_modules`, `.vinext`, `.wrangler`, and `build` are not evidence of a Buildmates feature.

## Verified hackathon constraints

- Event: OpenAI Build Week 2026 on Devpost.
- Category: Work and Productivity.
- Submission deadline: 2026-07-21 at 5:00 PM Pacific, equivalent to 2026-07-22T00:00:00Z.
- Submission requires a working project, a public YouTube demonstration shorter than three minutes with voiceover, a repository and README, and a Codex `/feedback` session ID.
- The video must cover the project and the use of Codex and GPT-5.6.
- Judging areas: technological implementation, design, potential impact, and quality of idea.
- The user is registered and submissions were open when verified.

These facts were verified during planning through the Devpost-connected app. They should be checked again before submission because event requirements can change.

## Verified platform direction

- ChatGPT Sites is the first web hosting target.
- Sites plan inclusion means no separate hosting bill within current beta plan limits; it does not mean unlimited storage, bandwidth, or execution.
- User-side Codex automations can perform scheduled inference under the user's plan and its limits.
- A Buildmates backend cannot silently spend a user's Codex allowance for independent always-on model calls.
- Day one therefore uses deterministic server logic and user-side Codex evaluations, with no Buildmates-funded inference.
- ChatGPT/Codex tasks can be the primary user notification surface. External transactional email is not a day-one requirement.

## Approved planning assumptions

- One required Buildmates plugin exposes guidance and a remote MCP app.
- Installed apps are discovered in the active conversation and permissioned one by one.
- Users can select Luna High for routine Buildmates automation and Luna Extra High for higher-value generative work; the plugin can recommend but not force the model.
- The implementation orchestrator uses the strongest available primary model for integration. The current collaboration tool may not expose per-subagent model selection, so model claims must reflect the actual runtime.
- Initial rooms are lightweight themed chat surfaces. Upgraded modules are explicitly deferred until after positive interaction feedback.

## Baseline risks to prove early

- Whether one Sites deployment can support the required remote MCP transport and identity mapping.
- Whether ChatGPT authentication produces a stable identity usable by both the web app and MCP flow.
- Whether D1/R2 bindings and migrations behave correctly in preview and production.
- Whether bounded polling produces an acceptable chat experience within Sites limits.
- Whether the installed-app discovery and per-app permission UX can be implemented without claiming access Codex does not expose.
- Whether scheduled automations can reliably retrieve inbound proposals and record a user-side evaluation.
