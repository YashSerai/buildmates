# Buildmates OpenAI Build Week demo script

Status: locked for scene production on 2026-07-21. Spoken copy may be shortened only during the final timing pass; any removed founder-reflection lines move into the Devpost write-up.

At the center of networking is work.

Work gives builders a real reason to talk. Maybe they are both trying to make voice agents feel less robotic. Maybe one is building the thing the other has been thinking about for weeks.

Nobody has time to keep a profile current, post every small thing they ship, then explain each project again in a cold message.

There should be a better way to share what you are working on.

So why not let the platform you already use to build keep track of what you are building?

People say X is the best place to find builders. But I think the people using Codex every day are a much better place to start.

Buildmates turns the context Codex already has into a living profile. It reviews the projects you are actively building, connects the pieces across them, and builds a profile around what you are actually doing now.

The profile is generative UI. Codex writes a responsive page around you, with its own layout, visual style, and way of telling your story.

Buildmates' matching algorithm then ranks people whose work or ambitions overlap with yours. Your Codex and the other person's Codex review the match independently using GPT-5.6. Each one looks for a reason its person would genuinely care.

You can review introductions yourself or turn on Full Autopilot and let Codex take the wheel.

Once the interest is mutual, Buildmates opens a persistent one-to-one chat.

That room is generative UI too. Two people working on voice agents could turn it into a shared testing lab with a latency timer, call-test board, and interruption tracker. The people in the room tell Codex what would help, and Codex builds it into the space.

Circles bring the same idea to group chats. A group focused on shipping might add a sprint tracker and timer. A local builder community might create an event board. The interface grows around what the group is doing.

A Codex automation called Work Pulse keeps your profile and network current. You decide how often it runs. It reviews recent work, refreshes your profile, looks for new matches, and follows up on introductions.

The City Map shows where builders are active. The Build Graph shows what the network is working on and where those topics overlap.

Buildmates helps the work you are already doing find someone worth talking to.

I built Buildmates end to end with Codex and GPT-5.6 for OpenAI Build Week. Since the theme was building with Codex, I thought, why not build for Codex too?

Codex helped me plan the product, build the web app and MCP, learn ChatGPT Sites for the first time, and test the full flow. It took four usage resets, so thanks to Thibault for those.

On screen: `RIP my banked resets`

GPT-5.6 is capable, but it still has rough edges. It would sometimes leak my instructions into the website copy. If I asked it to move something slightly to the right, the page might literally end up with subtext saying, “moved to the right.”

Some early UI passes were genuinely ugly. I saw white text on white backgrounds, overlapping elements, and huge empty spaces.

Design skills and screenshot QA made the difference. Once I gave Codex direct visual feedback and made it inspect what it had built, it could fix those issues and keep going.
