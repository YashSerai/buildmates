# Buildmates Build Week reflection

## Voiceover section

I built Buildmates end to end with Codex and GPT-5.6 for OpenAI Build Week.

Since the theme was building with Codex, I thought: why not build for Codex too?

Codex helped me plan the product, build the web app and MCP server, learn ChatGPT Sites for the first time, and test the full flow.

It took four usage resets, so thank you to Thibault for those.

The biggest product bottleneck was identity on ChatGPT Sites. I wanted the website to use Sign in with ChatGPT, but Sites did not expose the kind of secure identity token Buildmates needed. So the launch version uses GitHub OAuth for the website and links that account to Codex through the MCP flow.

The backend and testing work went well. The roughest parts were frontend design and copy. Codex would sometimes leak internal instructions into the product, or create UI with white text on white backgrounds, overlapping sections, and huge empty spaces.

Once I gave it stronger design skills, copy rules, and screenshot QA, it got much better.

The other lesson was testing discipline. Codex sometimes over-tested tiny changes, spending ten minutes validating something it built in thirty seconds. The better workflow was to build a meaningful chunk, then test the whole flow properly.

Buildmates is the result: a builder network where Codex turns the work you are already doing into a living profile, finds people worth talking to, and helps the relationship grow from there.

## Visual timing

- 0.0-6.0: Buildmates, Codex, GPT-5.6, and OpenAI Build Week resolve into one build system.
- 6.0-13.0: Real product and Codex screenshots show planning, web app, MCP, and testing.
- 13.0-22.0: The ChatGPT Sites identity bottleneck becomes a clear architecture beat: Sites identity gap, GitHub OAuth, one-time link, Codex MCP.
- 22.0-29.0: Four reset cards appear, with `RIP my banked resets` as the visible gag.
- 29.0-40.0: Rough-edge cards show copy leaks, bad contrast, overlap, empty space, and over-testing.
- 40.0-47.0: Skills, copy rules, screenshot QA, and focused test batches turn the rough cards into green checks.
- 47.0-55.0: Final product proof mosaic: homepage, profile, room, Circle, automation, map, and Build Graph.

No subtitles. Use labels only when they identify what the viewer is seeing.
