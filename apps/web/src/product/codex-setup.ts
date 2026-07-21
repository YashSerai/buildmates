export const BUILDMATES_INSTALL_URL =
  "https://buildmates.yashns.chatgpt.site/install";

export const BUILDMATES_CODEX_INSTRUCTIONS_URL =
  "https://buildmates.yashns.chatgpt.site/llms.txt";

export const BUILDMATES_APP_URL =
  "https://chatgpt.com/plugins/plugin_asdk_app_6a57d2ff080481918659b3355a3d9c0e";

export const BUILDMATES_SETUP_PROMPT = `Set up Buildmates for me using the official Codex instructions: ${BUILDMATES_CODEX_INSTRUCTIONS_URL}`;

export const BUILDMATES_CONTINUE_SETUP_PROMPT = `Continue my Buildmates setup from its current saved step. Call get_setup_state first, then use the official Codex instructions: ${BUILDMATES_CODEX_INSTRUCTIONS_URL}`;
