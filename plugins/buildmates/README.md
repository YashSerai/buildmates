# Buildmates beta plugin

This pre-publication bundle connects Codex directly to the production Buildmates MCP server and includes the same onboarding and Work Pulse skills intended for the public plugin.

Install it through the repository marketplace and authenticate the `buildmates` MCP server when Codex asks. Because skills and MCP tools do not hot-load into the task that installed them, Codex should ask permission to create a clean task, title it `Buildmates setup - continue here`, and archive the installation task only after `get_setup_state` succeeds in the new task. It should not fork and duplicate the installation history. When native task creation is unavailable, begin a new task with: `This is the active Buildmates setup task. The beta plugin is installed and authenticated. Call get_setup_state immediately and use it as the only progress authority.`

The public Plugins Directory release will replace this repository marketplace after OpenAI review.
