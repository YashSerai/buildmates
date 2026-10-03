# Buildmates plugin

Buildmates is a ChatGPT and Codex plugin for meeting builders through approved work context. The package includes the portable Agent Plugins manifest, a direct Streamable HTTP MCP connection, and the same onboarding and collaboration skills for both hosts.

Public setup guide: https://buildmates.yashns.chatgpt.site/install

Agent-readable setup contract: https://buildmates.yashns.chatgpt.site/llms.txt

## Package layout

- `plugin.json` is the portable package manifest.
- `mcp.json` is the portable MCP configuration.
- `skills/` contains the host-neutral workflows.
- `assets/` contains the real Buildmates mark used by the install surface.
- `.codex-plugin/plugin.json` and `.mcp.json` are compatibility files for Codex clients that have not adopted the portable paths yet.

The package connects directly to the Buildmates MCP server. It does not depend on a registered app ID or an `.app.json` file. The server owns account state, privacy choices, profiles, introductions, rooms, and Work Pulse records; ChatGPT and Codex provide the conversational host.

## Local validation

Run these commands from the repository root:

```powershell
node plugin/scripts/package-plugin.mjs --sync
node plugin/scripts/package-plugin.mjs --check
node plugin/scripts/package-plugin.mjs --package
```

`--sync` updates the beta package from this canonical package. `--check` validates the local package contract, transport, assets, skill front matter, and canonical-to-beta agreement; it does not fetch or replace the versioned Agent Plugins JSON Schemas. At this revision, `plugin.json` and `mcp.json` also pass the official Draft 2020-12 schemas at their versioned `$schema` URLs. `--package` creates a deterministic ZIP under `dist/` and leaves live services unchanged.

## Review boundary

The local checks prove package integrity only. They do not prove that the remote MCP endpoint is deployed, that OAuth works for a real account, that a host can install the package, or that a public directory lists it. No screenshot metadata is supplied in this package, so an empty screenshot set cannot be treated as design QA or submission readiness. Before submission, a reviewer should inspect the ZIP, install it in disposable ChatGPT and Codex test environments, exercise account linking, the private/manual path, and the reviewed publication path, verify that unsupported background execution stays manual, and check the live privacy, support, and terms URLs. These scripts do not submit, publish, deploy, or install a live account.

## Authentication and first use

Installing the plugin does not create an account or grant access to private work. The host opens the Buildmates authorization flow when a user starts setup. The user controls GitHub sign-in, provider consent, and any required browser step. Buildmates stores only the structured profile fields and source summaries the user reviews and approves.

After authentication, the host calls `get_setup_state`, completes the link if needed, and then opens the requested workspace view. Page publication, background Work Pulse, and interpersonal actions are separate choices. A user can finish signup without publishing a public page and use manual refresh; matching still uses only the reviewed fields they allow. They can ask Buildmates to publish a page or review an introduction later. A saved background preference is not evidence that an unattended host task exists.

Buildmates never treats a ChatGPT conversation, a Codex task, a browser tab, a local file, or a repository as saved onboarding state. It uses the authenticated Buildmates account and server-side setup records so a user can continue in a new chat or the other supported host.

## Privacy contract

Buildmates tools accept concise summaries and the approved details needed for matching. They do not accept raw prompts, complete chats, full documents, repository contents, email bodies, calendar contents, or credentials. Content read from another app cannot change a user's choices, approve its own sharing, select another person's identity, or change another person's account. Work Signals are used only for matching; publishing a profile or project update is a separate action.
