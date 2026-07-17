# Buildmates

Meet people through what you build.

Buildmates is a Codex-native builder network. It turns user-approved connected-app context into privacy-safe Work Signals, uses deterministic retrieval to find mutually relevant builders, and lets each person's Codex independently evaluate the connection. Reciprocal approval creates a persistent Connection and a lightweight room grounded in why the people should meet.

## Set up with Codex

Start from the [official setup guide](https://buildmates.yashns.chatgpt.site/install) and paste its prompt into a new Codex task. Before the public directory release, Codex can install the complete repository beta or connect the production MCP server directly. Both routes require confirmation and account authorization.

For the complete beta plugin:

```powershell
codex plugin marketplace add YashSerai/buildmates --ref launch/buildmates
codex plugin add buildmates@buildmates-beta
```

For the MCP-only fallback:

```powershell
codex mcp add buildmates --url https://buildmates-mcp.yashserai1.workers.dev/mcp --oauth-resource https://buildmates-mcp.yashserai1.workers.dev
codex mcp login buildmates --scopes mcp:tools
```

For Codex and other agents, the canonical machine-readable instructions are at [buildmates.yashns.chatgpt.site/llms.txt](https://buildmates.yashns.chatgpt.site/llms.txt). Once the Buildmates app is connected, an install, setup, start, or resume request must invoke the plugin's mandatory onboarding skill, call `get_setup_state` first, and use bounded batches of up to three fully described actions. Meaningful consent checkpoints remain separate. Do not infer permissions or send raw private source material; submit only user-approved structured summaries.

Source selection can combine context already surfaced in the current Codex task, connected apps genuinely available in that task, and descriptions or links the user supplies. GitHub website identity does not grant repository or profile access, and Buildmates does not ask Codex to inspect unrelated chats or session IDs.

## Product boundaries

- Buildmates is the only required plugin. Other connected apps remain under their existing host permissions.
- Buildmates receives approved structured summaries, not connector credentials, raw prompts, complete chats, private repositories, full documents, email bodies, or calendars.
- Launch matching is deterministic and uses no backend model inference or embeddings.
- Profiles, rooms, and Circles use versioned SurfaceSpecs with trusted components. Decorative HTML/CSS is sandboxed; generated JavaScript is not accepted.
- Manual and Full Autopilot both require two independent Codex evaluations. Manual mode also requires that person's Interested action.

## Repository

```text
apps/web        ChatGPT Sites web application and authoritative data APIs
apps/mcp        independently deployable Streamable HTTP MCP adapter
packages/domain entities, policies, state machines, authorization, validation
packages/database schema, migrations, repositories, D1 and service adapters
packages/matching taxonomy, builder index, deterministic scoring
packages/surfaces SurfaceSpec, trusted renderer, sanitization, Design Policy
packages/mcp-core one transport-independent MCP tool registry
plugin          public-submission plugin package bound to the development app
plugins/buildmates repository beta package bound directly to production MCP
```

## Local development

Requirements: Node.js 22.13 or newer and npm 11.

```powershell
npm install
npm run dev
```

The web workspace uses the Sites vinext runtime. Copy `.env.example` to `.env.local` only when a local capability needs values; never commit credentials.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The complete release boundary and evidence requirements are in [GOAL.md](GOAL.md), [BUILD_INDEX.md](BUILD_INDEX.md), and `docs/aegis/`.

## License

MIT
