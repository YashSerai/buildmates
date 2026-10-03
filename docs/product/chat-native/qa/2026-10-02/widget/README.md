# Buildmates embedded workspace QA

Date: 2026-10-02

This bundle records a local Chromium render of the MCP Apps widget at 390px and 1440px. The host bridge supplied the canonical service-shaped workspace DTOs used by the local chat service: `{ room, messages }` for rooms, `{ circleId, messages }` for Circle conversations, and `_meta.surfacePreview` for private previews. The payloads are bounded QA fixtures. They prove widget rendering and bridge behavior, not a live ChatGPT or Codex host install, an account mutation, or production availability.

The capture used the bundled Playwright Chromium executable at:

`C:\Users\yashs\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe`

Every capture reported no console errors, no page errors, no horizontal overflow, and 44px or larger button targets.

| Evidence | Viewport | What it covers |
| --- | ---: | --- |
| [room-composer-390.png](./room-composer-390.png) | 390px | Populated room messages and a working composer on phone layout |
| [room-composer-1440.png](./room-composer-1440.png) | 1440px | The same room DTO with desktop layout and composer |
| [room-long-390.png](./room-long-390.png) | 390px | Long authored message wrapping with the composer remaining usable |
| [preview-390.png](./preview-390.png) | 390px | Private profile preview in a sandboxed iframe |
| [preview-1440.png](./preview-1440.png) | 1440px | The same private preview at desktop width |
| [room-ended-390.png](./room-ended-390.png) | 390px | Ended room shows an unavailable message and no send control |
| [circle-archived-390.png](./circle-archived-390.png) | 390px | Archived Circle shows no send control |
| [circle-proposed-390.png](./circle-proposed-390.png) | 390px | Proposed Circle shows Open Circle but no conversation control |

The machine-readable measurements are in [qa-results.json](./qa-results.json). The final source checks were:

- `mcp-chat-ui.test.ts`: 4/4
- `mcp-chat-ui.test.ts` plus `chat-operations.test.ts`: 18/18
- `npm run typecheck --workspace @buildmates/mcp-core`
- focused ESLint and diff checks

The final room recapture shows `Grace` and `You` as the two message authors, keeps the composer visible for the active room, and omits the Members fact because the DTO did not provide a member count.
