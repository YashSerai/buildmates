# Buildmates beta plugin

This pre-publication bundle connects Codex directly to the production Buildmates MCP server and includes the same onboarding and Work Pulse skills intended for the public plugin.

Install it through the repository marketplace and authenticate the `buildmates` MCP server when Codex asks. Because skills and MCP tools do not hot-load into the task that installed them, Codex should ask permission to open a fresh task automatically. When native task creation is unavailable, begin a new task with: `Continue Buildmates setup. The beta plugin is installed and authenticated. Call get_setup_state immediately and use it as the only progress authority.`

The public Plugins Directory release will replace this repository marketplace after OpenAI review.
