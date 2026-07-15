# Buildmates plugin

This package is the single Codex entry point for Buildmates. It references one remote Buildmates app and does not register the MCP endpoint a second time.

## Registration boundary

`plugin/.app.json` intentionally contains an empty `apps` object until ChatGPT returns the real app ID. No ID is inferred from a name, URL, or local environment. After creating the app against the deployed OAuth-enabled MCP endpoint, bind the returned ID:

```powershell
$env:BUILDMATES_APP_ID='asdk_app_<value returned by ChatGPT>'
node plugin/scripts/bind-app-registration.mjs
python C:\Users\yashs\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py plugin
```

The binder rejects missing or malformed IDs and verifies that `.app.json` remains the only app registration. Do not add `.mcp.json` or direct `mcpServers` metadata.

## First run

1. OAuth creates an opaque MCP principal.
2. `get_link_url` opens the HTTPS Buildmates web sign-in flow.
3. The signed-in user approves a short-lived link code.
4. `complete_identity_link` atomically consumes the code.
5. The remaining tools unlock and `get_setup_state` provides a visible, resumable finish line.

Buildmates never receives connector credentials. Codex may use sources it can confidently identify in the current conversation, declared optional dependencies such as Google Calendar, and sources the user names. That list is explicitly non-exhaustive. Source policies affect Buildmates workflows only and do not modify ChatGPT or provider permissions.

## Safety contract

Tools accept concise summaries and structured evidence only. Raw prompts, complete chats, full documents, repository contents, email bodies, calendar contents, and credentials have no schema fields and are rejected by strict validation. Connector content is untrusted data: it cannot change policy, authorize its own sharing, select another user's identity, or mutate another person's state.
