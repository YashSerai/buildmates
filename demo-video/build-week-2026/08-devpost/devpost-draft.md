# Buildmates Devpost draft

## Project title

Buildmates

## Tagline

Meet people through what you build.

## Track

Work and Productivity

## Links

- Live project: https://buildmates.yashns.chatgpt.site
- Repository: https://github.com/YashSerai/buildmates
- Setup guide: https://buildmates.yashns.chatgpt.site/install
- Agent instructions: https://buildmates.yashns.chatgpt.site/llms.txt
- MCP endpoint: https://buildmates-mcp.yashserai1.workers.dev/mcp
- Demo video: add public YouTube link
- Codex `/feedback` session ID: add final session ID

## What I built

Buildmates is a builder network for people who are actively shipping.

Instead of asking people to keep another profile updated, Buildmates lets Codex turn the work someone is already doing into a living profile. The user chooses what Codex may review, Codex drafts the profile, and the user approves what Buildmates receives.

From there, Buildmates ranks people whose work or ambition overlaps. The user's Codex and the other person's Codex can each review the match independently, so an introduction is based on mutual relevance rather than popularity.

Once the interest is mutual, Buildmates opens a persistent one-to-one room. Rooms and Circles are generative UI too. A voice-agent conversation can become a shared testing lab. A cofounder conversation can become a decision log. A shipping group can add a sprint timer or tracker. Codex can design the interface and tools around what the relationship needs.

The product also includes Work Pulse, a Codex automation that keeps the network current. It can refresh approved profile context, look for new matches, surface follow-ups, and ask how an introduction went. The City Map and Build Graph give a broader view of where builders are active and what topics the network is working on.

## Inspiration

At the center of networking is work.

Work gives builders a real reason to talk. Maybe two people are both trying to make voice agents feel less robotic. Maybe one is building the thing another has been thinking about for weeks.

The problem is that networking usually starts from stale surfaces: bios, follower counts, job titles, cold messages, and manually maintained profiles. Builders are already producing the useful context somewhere else. They are writing specs, fixing bugs, shaping products, testing ideas, and making decisions inside tools like Codex.

Buildmates starts there.

The idea was to let the platform people already use to build help their work find someone worth talking to.

## How it works

1. A user starts Buildmates from Codex.
2. Codex asks what it may review.
3. Codex builds a private profile draft from approved workspace context, project folders, connected sources, or user-provided links.
4. The user approves the profile fields and networking preferences.
5. Codex designs a custom profile page as responsive HTML and CSS.
6. Buildmates validates the generated page, stores it as a private revision, and publishes only after approval.
7. Buildmates ranks possible matches with deterministic scoring.
8. Codex reviews a shortlist for genuine relevance.
9. Mutual interest creates an introduction and persistent room.
10. Work Pulse keeps profiles, matches, and follow-ups current.

## How I used Codex and GPT-5.6

I built Buildmates end to end with Codex and GPT-5.6 for OpenAI Build Week. Since the theme was building with Codex, I wanted to build something for Codex too.

Codex helped plan the product, build the ChatGPT Sites web app, build the MCP server, design the onboarding flow, test profile generation, debug auth and identity linking, seed demo data, and prepare the submission materials.

GPT-5.6 was most useful when it had product context and real screenshots. It could reason through architecture, privacy boundaries, matching flows, generated UI constraints, and full QA scenarios. It was less reliable when asked to make polished frontend work without direct visual review. Early UI passes had issues like white text on white backgrounds, overlapping layouts, and internal planning language leaking into product copy. The fix was stronger design rules, screenshot QA, and smaller feedback loops.

The product also uses GPT-5.6 as part of the matching concept. Buildmates does deterministic ranking first, then each person's Codex can review a bounded shortlist and decide whether the match is worth that person's attention.

## Built with

- Codex
- GPT-5.6
- ChatGPT Sites
- Streamable HTTP MCP
- Cloudflare Workers
- D1
- R2
- TypeScript
- React
- GitHub OAuth

## Technical implementation

Buildmates has two deployment units:

- Web app on ChatGPT Sites
- Streamable HTTP MCP server on Cloudflare Workers

The data layer uses the Sites storage model with D1 and R2. The MCP server and website share domain, matching, database, and surface-rendering packages from the monorepo.

The generated UI system uses GeneratedSiteBundle v3. Codex writes semantic HTML and responsive CSS, but not JavaScript. Generated pages run inside a scriptless, credential-isolated iframe. Buildmates owns identity, privacy, navigation, actions, approved content, media bindings, revision history, publishing, and governance outside the generated page.

That boundary lets profiles, rooms, and Circles feel custom without giving generated code access to private data or credentials.

## Challenges

The largest product bottleneck was identity on ChatGPT Sites. I wanted the website to use Sign in with ChatGPT, but the Sites runtime did not expose the secure identity token Buildmates needed. The launch version uses GitHub OAuth for the website and links that account to Codex through a one-time MCP code.

Another challenge was frontend quality. Codex could build the backend and state machines quickly, but the first visual passes were not launch-ready. The solution was to treat screenshots as evidence. If spacing, contrast, copy, or layout failed visually, the product was not done.

Testing discipline also mattered. Codex sometimes over-tested tiny changes and burned time. The better pattern was to build a complete flow, then test that flow end to end.

## What I am proud of

Buildmates is not just a matching app. It changes what a network can be when Codex is part of the interface.

The profile is not a static form. The room is not only a chat box. A Circle is not just a group thread. They can become custom software surfaces shaped by the people inside them.

I am also proud that the product keeps the privacy boundary clear. Buildmates does not need raw private work. It needs approved summaries, generated pages, and consented signals.

## What judges should notice

- The product works as a Codex-native flow, not only as a website.
- The profile, room, and Circle surfaces are generative UI, not fixed templates.
- Matching uses a practical hybrid: deterministic ranking first, then Codex review on a bounded shortlist.
- Work Pulse turns networking into an automation the user controls.
- The City Map and Build Graph make the network explorable without pretending demo fixtures are real traction.

## What is next

- Submit Buildmates as an app-plus-skills plugin with MCP.
- Improve the generated room and Circle tool system.
- Add stronger two-account QA and reviewer sandbox accounts.
- Expand Work Pulse feedback loops so introductions improve over time.
- Keep improving the Build Graph as a live view of what the builder network is working on.
- Remove demo fixtures after Build Week judging and replace them with organic activity.

## Judge testing notes

The live project is available at:

https://buildmates.yashns.chatgpt.site

Use the setup page for Codex instructions:

https://buildmates.yashns.chatgpt.site/install

Before the public plugin-directory release, the README includes beta plugin and direct MCP setup commands.

The City Map, Build Graph, and seeded introduction examples use fictional QA data retained for Build Week judging. They are demo fixtures, not organic traction.
