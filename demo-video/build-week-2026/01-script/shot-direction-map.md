# Buildmates Demo Shot Direction Map

Status: working production map. Keep this separate from `locked-script.md`; these are edit notes, not spoken copy.

Target: under 2:35 if read fast. If it runs long, cut the founder-reflection section first and move details into Devpost.

## 0:00-0:25 - Thesis Intro

Voiceover:

At the center of networking is work.

Work gives builders a real reason to talk. Maybe they are both trying to make voice agents feel less robotic. Maybe one is building the thing the other has been thinking about for weeks.

Nobody has time to keep a profile current, post every small thing they ship, then explain each project again in a cold message.

There should be a better way to share what you are working on.

So why not let the platform you already use to build keep track of what you are building?

Introducing Buildmates.

Show:

- HyperFrames intro only.
- `NETWORKING` appears. `NET` and `ING` fall away. `WORK` remains.
- Voice-agent overlap scene with labeled waveform cards.
- One person thinking about persistent memory, another building it, linked by the same idea.
- Profile-update burden cards pile up.
- Codex frontend turns active project context into a living profile.
- Cut cleanly to the live Buildmates homepage.

## 0:25-0:33 - Homepage

Voiceover:

People say X is the best place to find builders. But I think the people using Codex every day are a much better place to start.

Show:

- Live homepage hero.
- Keep the Buildmates logo and main CTA visible.
- Show the setup prompt affordance briefly.
- Do not linger on marketing copy. The homepage is proof of the product frame, not the whole demo.

## 0:33-0:52 - Codex Setup

Voiceover:

Buildmates turns the context Codex already has into a living profile. It reviews the projects you are actively building, connects the pieces across them, and builds a profile around what you are actually doing now.

Show:

- Codex task using the real setup prompt.
- Show setup step 1: Buildmates connected and setup state checked.
- Show source choice: "Use my Codex workspace."
- Show Codex reviewing project folders/tasks and producing the profile draft.
- If using screenshots, use 2-3 cropped chat screenshots with vertical movement, not a full unreadable wall.

## 0:52-1:08 - Generative Profile

Voiceover:

The profile is generative UI. Codex writes a responsive page around you, with its own layout, visual style, and way of telling your story.

Show:

- Codex proposes a design direction.
- Show the private profile preview.
- Show one quick revision if available.
- Show the published profile at `/builders/yashns`.
- If possible, show desktop first, then a quick phone-sized crop to prove responsive behavior.

## 1:08-1:25 - Matching

Voiceover:

Buildmates' matching algorithm then ranks people whose work or ambitions overlap with yours. Your Codex and the other person's Codex review the match independently using GPT-5.6. Each one looks for a reason its person would genuinely care.

Show:

- Matches or Introductions page with demo candidates.
- Show the Codex-side recommendation/check, not only a web card.
- Label the two sides visually as "Your Codex" and "Their Codex" if the UI already does.
- Avoid exposing internal IDs or database-looking fixtures.

## 1:25-1:35 - Manual Review and Full Autopilot

Voiceover:

You can review introductions yourself or turn on Full Autopilot and let Codex take the wheel.

Show:

- One pending introduction.
- Briefly show the review action.
- If Full Autopilot appears, show it as a setting or mode, not as the only flow.

## 1:35-1:55 - Room Generative UI

Voiceover:

Once the interest is mutual, Buildmates opens a persistent one-to-one chat.

That room is generative UI too. Two people working on voice agents could turn it into a shared testing lab with a latency timer, call-test board, and interruption tracker. The people in the room tell Codex what would help, and Codex builds it into the space.

Show:

- Open an existing demo Connection room.
- Show messages first, then the custom room/tool surface.
- If a custom room preview exists, show the private preview and approval/published state.
- The custom tool should look useful: timer, checklist, test board, or decision log.

## 1:55-2:08 - Circles

Voiceover:

Circles bring the same idea to group chats. A group focused on shipping might add a sprint tracker and timer. A local builder community might create an event board. The interface grows around what the group is doing.

Show:

- Circles page with one demo Circle.
- Open Circle.
- Show members, messages, and the custom Circle surface or tool proposal.
- Show that member/admin approval governs what goes live only if it is visually clear.

## 2:08-2:20 - Work Pulse

Voiceover:

A Codex automation called Work Pulse keeps your profile and network current. You decide how often it runs. It reviews recent work, refreshes your profile, looks for new matches, and follows up on introductions.

Show:

- Codex automation output, not just settings.
- Show it surfacing new matches or asking how an intro went.
- Use a cropped transcript or task screenshot with clear lines.
- If the automation page is shown, keep it short.

## 2:20-2:32 - Map and Build Graph

Voiceover:

The City Map shows where builders are active. The Build Graph shows what the network is working on and where those topics overlap.

Show:

- City Map with only the map and stats cropped cleanly.
- Build Graph topic atlas drill-down.
- 3D relationship web interaction if it reads clearly in video.
- Do not describe demo fixtures as organic traction.

## 2:32-2:55 - Build Week Reflection

Voiceover:

I built Buildmates end to end with Codex and GPT-5.6 for OpenAI Build Week. Since the theme was building with Codex, I thought, why not build for Codex too?

Codex helped me plan the product, build the web app and MCP, learn ChatGPT Sites for the first time, and test the full flow. The biggest platform bottleneck was auth: ChatGPT Sites did not give us a production-ready Sign in with ChatGPT path, so Buildmates uses GitHub for the website identity and links that to the Codex MCP identity separately.

It took four usage resets, so thanks to Thibault for those.

GPT-5.6 is capable, but it still has rough edges. It would sometimes leak my instructions into the website copy. If I asked it to move something slightly to the right, the page might literally end up with subtext saying, "moved to the right."

Some early UI passes were genuinely ugly. I saw white text on white backgrounds, overlapping elements, and huge empty spaces.

Design skills and screenshot QA made the difference. Once I gave Codex direct visual feedback and made it inspect what it had built, it could fix those issues and keep going.

Show:

- Use this only if timing allows.
- Show a quick "Built with Codex + GPT-5.6" card.
- Show ChatGPT Sites + MCP architecture as a simple three-label diagram only if needed.
- For the auth bottleneck, do not show scary security details. Say the product uses GitHub web login plus Codex MCP linking because Sites did not have production-ready Sign in with ChatGPT.
- On screen gag: `RIP my banked resets`.
- End on Buildmates logo and homepage/profile URL.

## Cut-First Lines If Over Time

Cut in this order:

1. The detailed GPT-5.6 rough edges paragraph.
2. The usage resets line.
3. The ChatGPT Sites auth explanation, unless Devpost specifically wants implementation struggles in the video.
4. The "People say X..." sentence.
5. The City Map and Build Graph sentence, if they are already visually obvious.

## Must-Keep Product Proof

- Homepage.
- Codex setup source selection and profile draft.
- Generative profile preview or published profile.
- Matching/introductions.
- One-to-one room with generative UI/tool.
- Circle or group custom space.
- Work Pulse automation output.
- Map or Build Graph.
