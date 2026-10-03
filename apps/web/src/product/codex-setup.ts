export const BUILDMATES_INSTALL_URL =
  "https://buildmates.yashns.chatgpt.site/install";

export const BUILDMATES_CODEX_INSTRUCTIONS_URL =
  "https://buildmates.yashns.chatgpt.site/llms.txt";

export const BUILDMATES_PLUGIN_URL = "https://buildmates.yashns.chatgpt.site";

export const BUILDMATES_SETUP_PROMPT = `Set up Buildmates for me in this chat. If it is not connected, use the host's native Buildmates installation flow. Read the current setup state and continue one reviewed choice at a time. Use the official Buildmates instructions: ${BUILDMATES_CODEX_INSTRUCTIONS_URL}`;

export const BUILDMATES_CONTINUE_SETUP_PROMPT = `Continue my Buildmates setup from its current saved step. Read the current Buildmates setup state first, then continue one reviewed choice at a time. Use the official Buildmates instructions: ${BUILDMATES_CODEX_INSTRUCTIONS_URL}`;
