# Buildmates

Meet people through what you build.

Buildmates is a Codex-native builder network. It turns user-approved connected-app context into privacy-safe Work Signals, uses deterministic retrieval to find mutually relevant builders, and lets each person's Codex independently evaluate the connection. Reciprocal approval creates a persistent Connection and a lightweight room grounded in why the people should meet.

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
plugin          Buildmates Codex plugin package
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
