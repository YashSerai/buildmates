# Widget edge evidence

Date: 2026-10-02

This capture came from `chat-widget-edge.spec.ts` using an isolated `about:blank` host and the installed Google Chrome executable. It exercises the embedded widget bridge and canonical service-shaped fixture payloads; it does not claim a live ChatGPT or Codex host connection.

The final run passed 6/6 tests. It covered keyboard focus, hostile multilingual and RTL text, 280px and 240px layouts, delayed and empty loading, malformed and rejected host reads, initialization origin and source checks, a 15-second host timeout, explicit message confirmation, retry identity rotation after editing, honest save uncertainty, and a sandboxed private preview.

| Evidence | Viewport | Coverage |
| --- | ---: | --- |
| `room-composer-280.png` | 280px | Active room composer with a filled draft |
| `room-280.png` | 280px | Active room with long authored message text |
| `profile-long-280.png` | 280px | Long multilingual and hostile text rendered literally |
| `profile-long-240.png` | 240px | Same text at the narrower phone boundary |
| `preview-390.png` | 390px | Private preview in a sandboxed iframe |

The browser pass reported no test failures or console/page errors. The static ESLint check and `@buildmates/mcp-core` TypeScript check passed. The contract suite passed 4/4 with the repository's bundled Node 24 runtime. The default machine Node 20 wrapper is below the repository engine requirement and still hits its existing `std-env` ESM/CJS startup error.
