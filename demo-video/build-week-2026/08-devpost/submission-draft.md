# Buildmates

Status: draft for Yash's review. Do not publish from this file.

## Track

Work and Productivity

## One-line description

A Codex-native builder network that turns the work you are already doing into a living profile and introductions worth having.

## Project description

Most professional profiles are snapshots. They go stale because the useful context is scattered across the projects, tasks, documents, and experiments a person is working on right now.

Buildmates starts from that live context. During setup, Codex can review the workspace and sources a builder approves. It connects related projects, drafts a profile, asks about anything uncertain, and publishes only the version the builder accepts. The page itself is generative UI: Codex writes a responsive profile with its own layout, visual language, and way of presenting the work.

Buildmates then uses a deterministic matching system to rank people whose work, interests, ambitions, stage, or location overlap. Each person's Codex independently reviews the proposed introduction with GPT-5.6. A mutual match creates a persistent one-to-one conversation. Builders can review those introductions themselves or enable Full Autopilot.

The generative interface continues after the match. A room can become a voice-agent testing lab with a latency timer, call-test board, and interruption tracker. Circles bring the same model to groups, where members can add a sprint tracker, research board, event board, or another tool that fits what they are doing. Generated rooms, Circles, profiles, and shared tools use private previews, approval rules, revision history, and responsive visual QA before publication.

Work Pulse is a Codex automation that keeps the network current. The builder chooses its schedule. It can refresh approved work context, look for new introductions, surface messages that need attention, and ask how a conversation went. The City Map and Build Graph turn anonymized network activity into two explorable views: where builders are active, what they are working on, and where topics overlap.

## Inspiration

You cannot spell networking without work. Yet most networking products put the profile and the connection count ahead of what someone is actually building.

I kept thinking about where builders already leave the clearest trail of their interests, taste, and ambition. For me, that place is Codex. It sees the products I return to, the problems I keep pushing on, and the details that never make it into a post. Buildmates asks Codex to turn that work into something another builder can understand and respond to.

## How I built it

I built Buildmates end to end with Codex and GPT-5.6 during OpenAI Build Week.

The repository is an npm and TypeScript monorepo. The web application runs on ChatGPT Sites with D1 for relational data and R2 for approved profile media. The remote Streamable HTTP MCP server runs independently on Cloudflare Workers. Website and MCP identities are linked through a short-lived, single-use code rather than email or display-name matching.

The matching backend is deterministic. It normalizes topics, projects, tools, stages, location preferences, and networking intent into a versioned builder index, then returns a bounded shortlist. GPT-5.6 runs inside each builder's Codex session to review that shortlist privately and decide whether a proposed connection is genuinely relevant. Buildmates does not need to run paid inference over the entire network.

Generative UI uses scriptless HTML and responsive CSS inside a credential-isolated iframe. Codex receives only approved content and media bindings. The server validates the bundle, strips unsafe behavior, keeps product actions outside the generated page, and stores every revision. One-to-one room designs require both members to approve; Circle publishing follows the Circle's member or admin rules.

I used Codex for the product contract, architecture, database and authorization work, MCP tools, matching, frontend implementation, deployment, test fixtures, security review, copy cleanup, and browser QA. The final phase used screenshot feedback heavily. Codex rendered the actual pages at desktop and phone sizes, inspected the output, fixed what failed, and repeated the affected test.

## How GPT-5.6 is used in the product

GPT-5.6 is the builder-side intelligence layer.

It studies the workspace context a user approves, connects facts across projects, drafts the profile, chooses a visual direction, writes the generative UI, reviews deterministic match candidates, explains relevant introductions, and runs Work Pulse. The other person's Codex performs its own review. The backend cannot approve a match on their behalf.

## Challenges

ChatGPT Sites was new to me, and the authentication boundary took the most careful work. The built-in sign-in flow did not expose a trustworthy application identity in this deployment, and direct requests could supply the same forwarded header names. I switched the website to app-owned GitHub OAuth, mapped GitHub's verified numeric account ID to a random Buildmates UUID, and kept ChatGPT/Codex as a separate MCP OAuth identity joined through a one-time code.

Generative UI was the other hard part. A schema-valid page can still be ugly. Early passes had white text on white backgrounds, overlapping elements, huge empty areas, and sometimes copy that repeated my implementation instruction. The fix was not another generic component library. I gave Codex concrete design references, added a design skill, required desktop and phone screenshots, and made rendered QA part of the generation workflow.

The Build Week run took four usage resets. RIP my banked resets, and thanks to Thibault for the resets that kept it moving.

## What I am proud of

Buildmates is a working network, not a static demo. It has resumable Codex onboarding, profile and project publishing, deterministic matching, reciprocal introduction logic, Full Autopilot, persistent conversations, Circle governance, messaging, activity, privacy and safety controls, exports, account deletion, a Map, and an interactive hierarchical and 3D Build Graph.

The part I care about most is the generative interface model. The profile, one-to-one room, Circle, and shared tools can all look and behave differently while the product keeps identity, privacy, permissions, and publishing rules outside the generated code.

## What I learned

GPT-5.6 can keep a large product moving across planning, implementation, deployment, and QA, but it needs evidence. The weakest results came when I asked for polish in the abstract. The strongest came when Codex could see the rendered page, compare it with a direct reference, and repair a specific defect.

I also learned that agentic products need an unusually clear first run. The user should always know what Codex learned, what it saved, what needs approval, and what happens next. A capable agent still feels broken when the state machine is ambiguous.

## What's next

The immediate next step is the public beta and real network density. I want to learn which matching signals lead to conversations people want to continue, which room upgrades groups actually keep using, and how often Work Pulse should run for different kinds of builders.

The native Buildmates plugin will be submitted for directory review. Until then, reviewers and beta users can install the repository plugin or connect the production MCP directly through the instructions on the live site.

## Built with

- Codex
- GPT-5.6
- TypeScript
- React and Next.js
- ChatGPT Sites
- Cloudflare Workers, D1, and R2
- MCP with OAuth and PKCE
- MapLibre and OpenFreeMap
- Three.js and D3
- Remotion

## Links

- Live product: https://buildmates.yashns.chatgpt.site
- Setup guide: https://buildmates.yashns.chatgpt.site/install
- Repository: https://github.com/YashSerai/buildmates
- Production MCP: https://buildmates-mcp.yashserai1.workers.dev/mcp
- Demo video: [ADD PUBLIC YOUTUBE URL]

## Reviewer setup

1. Open the setup guide and copy its Codex prompt.
2. Use the beta-plugin route for the complete skill plus MCP experience, or choose the direct MCP route.
3. Complete GitHub sign-in on the website and authorize Buildmates in Codex.
4. Let Codex guide the resumable setup. Nothing publishes until the profile preview is approved.
5. The Map and Build Graph contain clearly labeled demo-density data so their interactions can be judged before the public network is large.

## Final submission checks

- [ ] Replace the YouTube placeholder with a public video under three minutes.
- [ ] Confirm the final video has an English voiceover.
- [ ] Confirm the voiceover covers the product, Codex workflow, and GPT-5.6 integration.
- [ ] Confirm the public repository has the MIT license and current setup instructions.
- [ ] Keep the live product and repository available through judging.
- [ ] Add final screenshots and logo assets to Devpost.
- [ ] Review every claim against the deployed build before publishing.
