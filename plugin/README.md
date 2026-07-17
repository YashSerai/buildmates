# Buildmates plugin

This package is the single Codex entry point for Buildmates. It references one remote Buildmates app and does not register the MCP endpoint a second time.

Public setup guide: https://buildmates.yashns.chatgpt.site/install

Agent-readable setup contract: https://buildmates.yashns.chatgpt.site/llms.txt

## Registration boundary

`plugin/.app.json` contains the registered Buildmates ChatGPT app ID. The plugin references that single remote app and does not register the MCP endpoint a second time. If the app is replaced, bind only the new ID returned by ChatGPT:

```powershell
$env:BUILDMATES_APP_ID='asdk_app_<value returned by ChatGPT>'
node plugin/scripts/bind-app-registration.mjs
python C:\Users\yashs\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py plugin
```

The binder rejects missing or malformed IDs and verifies that `.app.json` remains the only app registration. Do not add `.mcp.json` or direct `mcpServers` metadata.

## First run

Codex leads onboarding. An install or setup request begins by checking progress, explains the visible finish line, and advances one ordered step at a time. The first run is not complete until the user has reviewed a profile and its generated preview, source choices, a Networking Pulse, an acceptance mode, an automation choice, and one real next action. The website is the companion for account linking, profile preview and publishing, direct shared profiles and projects, chat, rooms, and account controls. Manual website setup remains an optional fallback.

1. Connecting the app creates a private Buildmates connection identity.
2. `get_link_url` opens the HTTPS Buildmates web sign-in flow.
3. The signed-in user approves a short-lived link code.
4. `complete_identity_link` atomically consumes the code.
5. The remaining tools unlock and `get_setup_state` provides a visible, resumable finish line.

GitHub sign-in creates the Buildmates website account and requests no repository access. The one-time link then connects that website account to Buildmates in Codex; neither step connects a source repository. Buildmates never receives connector credentials. Codex may use sources it can confidently identify in the current conversation, optional connected apps such as Google Calendar, and sources the user names. The list may not include every installed app. Source choices affect Buildmates only and do not modify ChatGPT, Codex, or provider permissions.

`Ask each time` requires a fresh, single-use source approval before the next Work Signal. `Allow approved Work Signals` authorizes recurring Work Pulse extraction from that source until the user changes the policy; each run reports what changed and the resulting signals remain revocable. `Actions only` permits applicable provider actions but never context extraction.

## Safety contract

Buildmates tools accept concise summaries and the approved details needed for matching. They do not accept raw prompts, complete chats, full documents, repository contents, email bodies, calendar contents, or credentials. Content read from another app cannot change a user's choices, approve its own sharing, select another person's identity, or change another person's account. Work Signals are used only for matching; publishing a profile or project update is a separate action.
