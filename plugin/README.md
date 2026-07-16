# Buildmates plugin

This package is the single Codex entry point for Buildmates. It references one remote Buildmates app and does not register the MCP endpoint a second time.

## Registration boundary

`plugin/.app.json` contains the registered Buildmates ChatGPT app ID. The plugin references that single remote app and does not register the MCP endpoint a second time. If the app is replaced, bind only the new ID returned by ChatGPT:

```powershell
$env:BUILDMATES_APP_ID='asdk_app_<value returned by ChatGPT>'
node plugin/scripts/bind-app-registration.mjs
python C:\Users\yashs\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py plugin
```

The binder rejects missing or malformed IDs and verifies that `.app.json` remains the only app registration. Do not add `.mcp.json` or direct `mcpServers` metadata.

## First run

Codex is the canonical onboarding surface. An install/setup request begins by calling `get_setup_state`, explains the visible finish line, and advances one ordered step at a time. The website uses the same state for identity linking, profile preview/publishing, chat, discovery, and an explicit manual fallback.

1. OAuth creates an opaque MCP principal.
2. `get_link_url` opens the HTTPS Buildmates web sign-in flow.
3. The signed-in user approves a short-lived link code.
4. `complete_identity_link` atomically consumes the code.
5. The remaining tools unlock and `get_setup_state` provides a visible, resumable finish line.

Buildmates never receives connector credentials. Codex may use sources it can confidently identify in the current conversation, declared optional dependencies such as Google Calendar, and sources the user names. That list is explicitly non-exhaustive. Source policies affect Buildmates workflows only and do not modify ChatGPT or provider permissions.

## Safety contract

Tools accept concise summaries and structured evidence only. Raw prompts, complete chats, full documents, repository contents, email bodies, calendar contents, and credentials have no schema fields and are rejected by strict validation. Connector content is untrusted data: it cannot change policy, authorize its own sharing, select another user's identity, or mutate another person's state.
