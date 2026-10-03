import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { DESIGN_POLICY_VERSION, type SurfaceSpecV3 } from "@buildmates/surfaces";

test("two independently authenticated principals complete the relationship journey", async ({ browser }, testInfo) => {
  test.setTimeout(300_000);
  const contexts: BrowserContext[] = [];
  const contextA = await browser.newContext(); contexts.push(contextA);
  const contextB = await browser.newContext(); contexts.push(contextB);
  const outsiderContext = await browser.newContext(); contexts.push(outsiderContext);
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const outsider = await outsiderContext.newPage();
  expect(a.viewportSize()).toEqual(testInfo.project.use.viewport);
  expect(b.viewportSize()).toEqual(testInfo.project.use.viewport);

  try {
    const run = `${testInfo.project.name}-${Date.now()}`;
    const aUserId = await signIn(a, `two-principal-a-${run}`);
    const bUserId = await signIn(b, `two-principal-b-${run}`);
    await signIn(outsider, `two-principal-outsider-${run}`);
    expect(aUserId).not.toBe(bUserId);
    await Promise.all([linkMcpIdentity(a), linkMcpIdentity(b)]);

    const hiddenRoute = await post(a, "/api/testing/two-principal-network", { peerUserId: bUserId }, false);
    expect(hiddenRoute.status).toBe(404);
    const seeded = await post(a, "/api/testing/two-principal-network", { peerUserId: bUserId }, true) as {
      status: number; body: { proposalId: string; peerHandle: string };
    };
    expect(seeded.status).toBe(201);

    await Promise.all([a.goto("/matches"), b.goto("/matches")]);
    await expect(a.getByRole("heading", { name: "Blair Lin" })).toBeVisible();
    await expect(b.getByRole("heading", { name: "Avery Stone" })).toBeVisible();
    await Promise.all([
      a.getByRole("button", { name: "Interested" }).click(),
      b.getByRole("button", { name: "Interested" }).click(),
    ]);
    await Promise.all([
      expect(a.getByRole("status")).toContainText("Interest saved"),
      expect(b.getByRole("status")).toContainText("Interest saved"),
    ]);

    await Promise.all([a.goto("/connections"), b.goto("/connections")]);
    await expect(a.getByRole("heading", { name: "Blair Lin" })).toHaveCount(1);
    await expect(b.getByRole("heading", { name: "Avery Stone" })).toHaveCount(1);
    const aConnection = a.locator("article").filter({ has: a.getByRole("heading", { name: "Blair Lin" }) });
    const bConnection = b.locator("article").filter({ has: b.getByRole("heading", { name: "Avery Stone" }) });
    const connectionId = await aConnection.getAttribute("id");
    expect(connectionId).toBeTruthy();
    expect(await bConnection.getAttribute("id")).toBe(connectionId);
    const roomHref = await aConnection.getByRole("link", { name: "Open room" }).getAttribute("href");
    expect(roomHref).toMatch(/^\/rooms\//);
    const roomId = roomHref!.split("/").pop()!;
    expect(await bConnection.getByRole("link", { name: "Open room" }).getAttribute("href")).toBe(roomHref);

    await a.goto(roomHref!);
    const composer = a.getByLabel("Message Blair Lin");
    const sendMessage = a.getByRole("button", { name: "Send message" });
    await expect(composer).toBeEnabled();
    await composer.fill("The two-principal browser check reached the shared room.");
    await expect(sendMessage).toBeEnabled();
    await sendMessage.click();
    await b.goto(roomHref!);
    await expect(b.getByText("The two-principal browser check reached the shared room.", { exact: true })).toBeVisible();
    await b.goto("/inbox");
    await expect(b.getByText("New message", { exact: true })).toBeVisible();
    await b.getByRole("button", { name: "Mark all read" }).click();
    await expect(b.getByRole("button", { name: "Mark all read" })).toHaveCount(0);

    await a.goto("/connections");
    await a.getByRole("button", { name: "Manage" }).click();
    await a.getByLabel("Private note").fill("Avery-only launch note");
    await a.getByRole("button", { name: "Save note" }).click();
    await expect(a.getByRole("status")).toContainText("Private note saved");
    const peerDetail = await get(b, `/api/connections/${connectionId}`) as { status: number; body: { privateNote: string | null } };
    expect(peerDetail.status).toBe(200);
    expect(peerDetail.body.privateNote).toBeNull();
    expect((await get(outsider, `/api/connections/${connectionId}`)).status).toBe(404);

    await a.getByRole("button", { name: "Save feedback" }).click();
    await expect(a.getByRole("status")).toContainText("Private feedback saved", { timeout: 15_000 });
    await a.goto(roomHref!);
    await a.getByText("Shared room tools", { exact: true }).click();
    await expect(a.getByRole("heading", { name: "Propose one shared tool" })).toBeVisible();
    await a.getByLabel("Shared tool").selectOption("decision_log");
    await a.getByLabel("How would this help your conversation?").fill("Keep decisions from the retrieval experiment in one shared place.");
    await a.getByRole("button", { name: "Propose shared tool" }).click();
    await b.goto(roomHref!);
    await b.getByText("Shared room tools", { exact: true }).click();
    await expect(b.getByText("Keep decisions from the retrieval experiment", { exact: false })).toBeVisible();
    await b.getByRole("button", { name: "Approve tool" }).click();
    await expect(b.getByRole("heading", { name: "Decision log" })).toBeVisible();

    const drafted = await post(a, `/api/rooms/${roomId}/surface`, { action: "draft", spec: roomSurfaceSpec }) as {
      status: number; body: { id: string };
    };
    expect(drafted.status, JSON.stringify(drafted.body)).toBe(201);
    await approveRoomDesign(a, roomHref!);
    await approveRoomDesign(b, roomHref!);
    await a.goto(roomHref!);
    await a.getByText("Redesign this room with Codex", { exact: true }).click();
    await a.getByRole("button", { name: "Publish shared design" }).click();
    await expect(a.getByText("Shared room design published.", { exact: true })).toBeVisible();

    const circleCreated = await post(a, "/api/circles", {
      name: "Reliable Agents Lab",
      purpose: "Compare reliable agent workflows through real experiments and shared decisions.",
      governanceMode: "admin",
      inviteeUserIds: [bUserId],
    }) as { status: number; body: { id: string } };
    expect(circleCreated.status).toBe(201);
    const circleId = circleCreated.body.id;
    let releaseCircleScripts!: () => void;
    const circleScriptGate = new Promise<void>((resolve) => { releaseCircleScripts = resolve; });
    const holdCircleScripts = async (route: import("@playwright/test").Route) => {
      if (route.request().resourceType() === "script") await circleScriptGate;
      await route.continue();
    };
    await b.route("**/*", holdCircleScripts);
    const joinCircle = b.getByRole("button", { name: "Join Circle" });
    try {
      await b.goto(`/circles/${circleId}`, { waitUntil: "commit" });
      await expect(joinCircle).toBeDisabled();
    } finally {
      releaseCircleScripts();
      await b.unrouteAll({ behavior: "wait" });
    }
    await joinCircle.click();
    await expect(b.getByRole("heading", { name: "Circle chat" })).toBeVisible({ timeout: 15_000 });
    await b.getByLabel("Message the Circle").fill("Blair joined through a separately authenticated browser session.");
    await b.getByRole("button", { name: "Send" }).click();
    await a.goto(`/circles/${circleId}`);
    await expect(a.getByText("Blair joined through a separately authenticated browser session.", { exact: true })).toBeVisible();

    await b.goto(`/circles/${circleId}`);
    await b.getByText("Proposals", { exact: true }).click();
    await b.getByLabel("What would you like to change?").fill("Add a retrieval experiment tracker");
    await b.getByLabel("What should this help the Circle do?").fill("Compare retrieval experiments without losing their results");
    await b.getByRole("button", { name: "Save request" }).click();
    await expect(b.getByText("Request saved.", { exact: false })).toBeVisible();

    const toolProposal = await post(b, `/api/circles/${circleId}`, {
      action: "propose",
      kind: "module",
      payload: {
        kind: "experiment_tracker",
        config: {
          title: "Retrieval experiment tracker",
          appearance: {
            concept: {
              source: "imagegen",
              direction: "Approved functional experiment board with clear status, evidence, and outcome hierarchy.",
              referenceLabel: "Retrieval field board concept",
              approvedByUser: true,
            },
            layout: "cards",
            density: "comfortable",
            typography: { display: "grotesk", body: "humanist" },
            tokens: {
              canvas: "#eef0e8",
              surface: "#f4f0e6",
              surfaceStrong: "#e2dccd",
              text: "#172019",
              mutedText: "#4f584f",
              accent: "#b8d36a",
              accentText: "#172019",
              border: "#7c877d",
              focus: "#8b3d16",
            },
            motion: "subtle",
          },
        },
      },
    }) as { status: number };
    expect(toolProposal.status).toBe(200);

    await a.goto(`/circles/${circleId}`);
    await a.getByText("Proposals", { exact: true }).click();
    await expect(a.getByRole("heading", { name: "Retrieval experiment tracker", exact: true })).toBeVisible();
    await a.getByRole("button", { name: "Publish approved change" }).click();
    await a.locator("details").filter({ hasText: "Active shared tools" }).locator("summary").click();
    await expect(a.locator("p").filter({ hasText: /^Experiment tracker$/ })).toBeVisible();

    const circleDesign = await post(b, `/api/circles/${circleId}`, {
      action: "propose",
      kind: "design",
      payload: { title: "Shared field notebook", spec: circleSurfaceSpec },
    }) as { status: number };
    expect(circleDesign.status).toBe(200);

    await a.goto(`/circles/${circleId}`);
    await a.getByText("Proposals", { exact: true }).click();
    await expect(a.getByRole("heading", { name: "Shared field notebook" })).toBeVisible();
    await a.getByRole("button", { name: "Publish approved change" }).click();
    await expect(a.getByRole("status")).toContainText("Approved change published to the Circle.");
    await a.getByText("Members and administration", { exact: true }).click();
    await a.getByRole("button", { name: "Make admin" }).click();
    await expect(a.getByText("Admin / Joined", { exact: true })).toBeVisible();
    await expect(a.getByRole("status")).toBeEmpty();
    await a.locator("details").filter({ hasText: "Active shared tools" }).locator("summary").click();
    await expect(a.locator('[data-module-layout="cards"]')).toBeVisible();
    const moduleWorkspace = a.locator('[data-module-layout="cards"]');
    await moduleWorkspace.getByLabel("Experiment", { exact: true }).fill("Compare retrieval overlap");
    await moduleWorkspace.getByRole("button", { name: "Add entry" }).click();
    await expect(moduleWorkspace.getByRole("heading", { name: "Compare retrieval overlap" })).toBeVisible();

    let releaseActiveCircleScripts!: () => void;
    const activeCircleScriptGate = new Promise<void>((resolve) => { releaseActiveCircleScripts = resolve; });
    await a.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await activeCircleScriptGate;
      await route.continue();
    });
    try {
      await a.goto(`/circles/${circleId}`, { waitUntil: "commit" });
      await expect(a.getByRole("button", { name: "Copy Codex prompt", includeHidden: true })).toBeDisabled();
      await expect(a.getByRole("button", { name: "Edit", exact: true, includeHidden: true })).toBeDisabled();
      await expect(a.getByRole("button", { name: "Delete", exact: true, includeHidden: true })).toBeDisabled();
      await expect(a.getByRole("button", { name: "Add entry", includeHidden: true })).toBeDisabled();
    } finally {
      releaseActiveCircleScripts();
      await a.unrouteAll({ behavior: "wait" });
    }
    await a.waitForLoadState("load", { timeout: 30_000 });
    await expect(a.locator('[data-hydrated="true"]').first()).toHaveCount(1);
    await a.getByText("Proposals", { exact: true }).click();
    await a.locator("details").filter({ hasText: "Active shared tools" }).locator("summary").click();
    await a.getByRole("button", { name: "Edit", exact: true }).click();
    await a.getByLabel("Experiment", { exact: true }).first().fill("Compare retrieval overlap after review");
    await a.getByRole("button", { name: "Save changes" }).click();
    await expect(a.getByRole("heading", { name: "Compare retrieval overlap after review" })).toBeVisible();
    await a.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(a.getByRole("heading", { name: "Compare retrieval overlap after review" })).toHaveCount(0);
    await a.screenshot({ path: testInfo.outputPath("circle-owner-governance.png"), fullPage: true, caret: "initial" });
    await b.goto(`/circles/${circleId}`);
    await expect(b.getByText("Blair joined through a separately authenticated browser session.", { exact: true })).toBeVisible();
    await b.screenshot({ path: testInfo.outputPath("circle-member-chat.png"), fullPage: true, caret: "initial" });

    const projectSlug = `shared-retrieval-${Date.now()}`;
    const createdProject = await post(a, "/api/projects", {
      slug: projectSlug,
      title: "Shared retrieval field test",
      summary: "A private project used to verify accepted collaboration and ownership transfer.",
      audience: "private",
      allowMatching: false,
      stage: "Testing",
      status: "active",
      links: [],
      taxonomy: [],
    }) as { status: number };
    expect(createdProject.status).toBe(201);
    const invited = await post(a, `/api/projects/${projectSlug}/collaborators`, {
      handle: seeded.body.peerHandle,
      role: "editor",
    }) as { status: number };
    expect(invited.status).toBe(201);
    await b.goto(`/projects/${projectSlug}/collaboration`);
    await expect(b.getByRole("heading", { name: "Shared retrieval field test" })).toBeVisible();
    await b.getByRole("button", { name: "Accept collaboration" }).click();
    await expect(b.getByRole("heading", { name: "Shared retrieval field test" })).toBeVisible();
    const update = await post(b, `/api/projects/${projectSlug}/updates`, {
      body: "Blair recorded the first shared retrieval result.",
      audience: "private",
    }) as { status: number };
    expect(update.status).toBe(201);
    await a.goto(`/projects/${projectSlug}`);
    await expect(a.getByText("Blair recorded the first shared retrieval result.", { exact: true })).toBeVisible();
    const transferred = await post(a, `/api/projects/${projectSlug}/collaborators`, { newOwnerUserId: bUserId }, false, "PUT") as { status: number };
    expect(transferred.status).toBe(200);
    const transferredProject = await get(b, `/api/projects/${projectSlug}`) as { status: number; body: { ownerUserId: string } };
    expect(transferredProject.status).toBe(200);
    expect(transferredProject.body.ownerUserId).toBe(bUserId);
    expect((await get(outsider, `/api/projects/${projectSlug}`)).status).toBe(404);

    for (const path of [
      `/api/connections/${connectionId}`,
      `/api/rooms/${roomId}/messages`,
      `/api/rooms/${roomId}/surface`,
      `/api/circles/${circleId}`,
    ]) expect((await get(outsider, path)).status, path).toBe(404);

    await a.screenshot({ path: testInfo.outputPath("two-principal-owner.png"), fullPage: true, caret: "initial" });
    await b.screenshot({ path: testInfo.outputPath("two-principal-member.png"), fullPage: true, caret: "initial" });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

async function signIn(page: Page, subject: string): Promise<string> {
  await page.goto("/");
  const result = await page.evaluate(async (label) => {
    let hash = 2166136261;
    for (let index = 0; index < label.length; index += 1) {
      hash ^= label.charCodeAt(index); hash = Math.imul(hash, 16777619);
    }
    const response = await fetch("/api/testing/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-buildmates-e2e": "1" },
      body: JSON.stringify({ subject: (hash >>> 0) + 1 }),
    });
    return { status: response.status, text: await response.text() };
  }, subject);
  if (result.status !== 201) throw new Error(`test_sign_in_failed:${result.status}:${result.text}`);
  return (JSON.parse(result.text) as { userId: string }).userId;
}

async function linkMcpIdentity(page: Page) {
  const result = await page.evaluate(async () => {
    const codeResponse = await fetch("/api/identity/link-code", { method: "POST" });
    const codeBody = await codeResponse.json() as { code?: string };
    if (!codeResponse.ok || !codeBody.code) return { status: codeResponse.status };
    const linked = await fetch("/api/testing/complete-link", {
      method: "POST",
      headers: { "content-type": "application/json", "x-buildmates-e2e": "1" },
      body: JSON.stringify({ code: codeBody.code }),
    });
    return { status: linked.status };
  });
  expect(result.status).toBe(200);
}

async function approveRoomDesign(page: Page, roomHref: string) {
  await page.goto(roomHref);
  await page.getByText("Redesign this room with Codex", { exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Preview approved.", { exact: true })).toBeVisible();
}

async function get(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    let body: unknown = null; try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }, path);
}

async function post(page: Page, path: string, body: unknown, includeTestHeader?: boolean, method: "POST" | "PUT" | "PATCH" = "POST") {
  return page.evaluate(async ({ url, payload, testHeader, requestMethod }) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (testHeader) headers["x-buildmates-e2e"] = "1";
    const response = await fetch(url, { method: requestMethod, headers, body: JSON.stringify(payload) });
    const text = await response.text();
    let parsed: unknown = null; try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: response.status, body: parsed };
  }, { url: path, payload: body, testHeader: includeTestHeader, requestMethod: method });
}


const roomSurfaceSpec = {
  schemaVersion: "3",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "room",
  title: "Shared retrieval room",
  document: {
    html: '<main class="room"><p class="eyebrow">Shared room</p><h1>{{room.title}}</h1><section><h2>{{room.whyTitle}}</h2><p>{{room.whyBody}}</p><dl><template data-buildmates-repeat="room.sharedFacts"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></section><p class="privacy">{{room.privacyNote}}</p></main>',
    css: ':root{color-scheme:dark}.room{box-sizing:border-box;max-width:76rem;margin:auto;padding:clamp(1.25rem,6vw,5rem);background:#17251d;color:#f6f0df;font-family:Georgia,serif}.room h1{max-width:11ch;font-size:clamp(3rem,9vw,8rem);line-height:.9}.room section{border-top:1px solid #839477;padding-top:2rem}.room dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:1rem}.room dt{color:#bdd38f}.privacy{max-width:60ch;color:#c7c9bf}@media(max-width:600px){.room{padding:1rem}.room h1{font-size:clamp(2.7rem,15vw,5rem)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}',
  },
  bindingManifest: { content: [{ key: "room.title", type: "text" }, { key: "room.whyTitle", type: "text" }, { key: "room.whyBody", type: "text" }, { key: "room.sharedFacts", type: "facts" }, { key: "room.privacyNote", type: "text" }], media: [] },
  approvedAssets: [], responsive: { desktopMinHeight: 900, phoneMinHeight: 1050 }, accessibility: { label: "Shared retrieval room", reducedMotion: "required" },
} satisfies SurfaceSpecV3;

const circleSurfaceSpec = {
  schemaVersion: "3",
  designPolicyVersion: DESIGN_POLICY_VERSION,
  kind: "circle",
  title: "Shared field notebook",
  document: {
    html: '<main class="circle"><header><p>Field notebook</p><h1>{{circle.name}}</h1><p>{{circle.purpose}}</p></header><section><h2>Members</h2><dl><template data-buildmates-repeat="circle.members"><div><dt>{{item.label}}</dt><dd>{{item.value}}</dd></div></template></dl></section></main>',
    css: ':root{color-scheme:light}.circle{box-sizing:border-box;max-width:78rem;margin:auto;padding:clamp(1.25rem,6vw,5rem);background:#f4eedf;color:#172018;font-family:Georgia,serif}.circle header{border-bottom:2px solid #172018;padding-bottom:3rem}.circle h1{max-width:12ch;font-size:clamp(3rem,10vw,8rem);line-height:.88}.circle dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1rem}.circle dl div{border-top:1px solid #8b9485;padding-top:1rem}@media(max-width:600px){.circle{padding:1rem}.circle h1{font-size:clamp(2.7rem,16vw,5rem)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}',
  },
  bindingManifest: { content: [{ key: "circle.name", type: "text" }, { key: "circle.purpose", type: "text" }, { key: "circle.members", type: "facts" }], media: [] },
  approvedAssets: [], responsive: { desktopMinHeight: 900, phoneMinHeight: 1050 }, accessibility: { label: "Reliable Agents Lab", reducedMotion: "required" },
} satisfies SurfaceSpecV3;
