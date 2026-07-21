# Buildmates

Meet people through what you build.

Buildmates is a Codex-native builder network. Codex turns the work a builder is already doing into a living profile, Buildmates ranks people whose work or ambition overlaps, and each person's Codex can review the match before anything interpersonal happens.

The goal is simple: make networking start from real work instead of stale profiles, cold messages, and popularity signals.

Live app: [buildmates.yashns.chatgpt.site](https://buildmates.yashns.chatgpt.site)  
Codex setup guide: [buildmates.yashns.chatgpt.site/install](https://buildmates.yashns.chatgpt.site/install)  
Agent instructions: [buildmates.yashns.chatgpt.site/llms.txt](https://buildmates.yashns.chatgpt.site/llms.txt)  
Production MCP endpoint: `https://buildmates-mcp.yashserai1.workers.dev/mcp`

## What it does

- Creates a builder profile from Codex context the user approves.
- Lets Codex design a custom responsive profile page with generated HTML and CSS.
- Matches builders through mutual relevance, not popularity.
- Supports Manual review and Full Autopilot for introductions.
- Opens persistent one-to-one rooms after mutual interest.
- Lets Codex redesign rooms and Circles with custom tools such as timers, checklists, research boards, decision logs, or trackers.
- Runs Work Pulse as a Codex automation to refresh approved context, find matches, surface follow-ups, and ask how introductions went.
- Shows a City Map and Build Graph so the network can be explored by location and topic overlap.

## How Buildmates uses Codex and GPT-5.6

Buildmates was built for OpenAI Build Week with Codex and GPT-5.6.

Codex helped plan the product, build the ChatGPT Sites app, build the MCP server, design and revise generated profile surfaces, test onboarding, seed QA data, and prepare the demo. The strongest workflow was not asking Codex to make tiny isolated changes forever. The better workflow was to build a meaningful product slice, run the real flow, inspect screenshots, then fix the exact defects.

GPT-5.6 is also part of the product. Buildmates does deterministic server-side ranking first. Then the user's Codex and the other person's Codex can independently review a bounded shortlist and look for a reason the connection would genuinely matter.

## Architecture

This is a monorepo with separate deployment units.

```text
apps/web        ChatGPT Sites web app, auth, product UI, and data APIs
apps/mcp        Streamable HTTP MCP adapter for Codex
packages/domain entities, policies, state machines, authorization, validation
packages/database schema, migrations, repositories, D1 and service adapters
packages/matching taxonomy, builder index, deterministic scoring
packages/surfaces generated-site contracts, sanitization, revision history
packages/mcp-core transport-independent MCP tool registry
plugin          public-submission plugin package
plugins/buildmates repository beta package bound to production MCP
```

The website runs on ChatGPT Sites. The MCP server runs separately at the production Worker endpoint so the web app and Codex connector are not locked to one runtime.

## Identity and privacy model

Buildmates uses GitHub OAuth for the website and MCP OAuth for Codex. Those are separate identity boundaries. A short-lived one-time code links the website account to the Codex MCP account.

Buildmates never receives connector credentials. Codex reads only what the user approves in its own environment and submits structured summaries. Raw private repositories, full chats, documents, emails, calendars, and prompts are not stored by Buildmates.

Generated profile, room, and Circle pages use GeneratedSiteBundle v3:

- Codex writes semantic HTML and responsive CSS.
- Generated JavaScript is not accepted.
- Generated pages run inside a scriptless, credential-isolated iframe.
- Buildmates keeps identity, privacy, navigation, actions, approved content, media bindings, revision history, and publishing controls outside the generated page.

## Try it with Codex

Start from the live setup page:

[buildmates.yashns.chatgpt.site/install](https://buildmates.yashns.chatgpt.site/install)

Before the public plugin-directory release, reviewers can use the repository beta plugin:

```powershell
codex plugin marketplace add YashSerai/buildmates --ref launch/buildmates
codex plugin add buildmates@buildmates-beta
```

Then start setup from the prompt on the website.

If the beta plugin route is unavailable, connect the production MCP server directly:

```powershell
codex mcp add buildmates --url https://buildmates-mcp.yashserai1.workers.dev/mcp --oauth-resource https://buildmates-mcp.yashserai1.workers.dev
codex mcp login buildmates --scopes mcp:tools
```

Supported platform for the tested flow: Codex on Windows with the production Buildmates website and MCP endpoint.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm 11 or newer

```powershell
npm install
npm run dev
```

Copy `.env.example` to `.env.local` only when a local capability needs values. Do not commit credentials.

## Verification

Use the full suite when changing product code:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

For submission review, the live app is the primary test surface. The demo data used for the City Map, Build Graph, and seeded introductions is fictional QA data retained for OpenAI Build Week judging. It should not be described as organic usage or traction.

## Build Week submission notes

Recommended Devpost category: Work and Productivity.

The submission should include:

- Live app URL: `https://buildmates.yashns.chatgpt.site`
- Repository URL: `https://github.com/YashSerai/buildmates`
- Demo video: public YouTube URL, under 3 minutes, with voiceover
- `/feedback` Codex session ID from the main build task

## License

MIT
