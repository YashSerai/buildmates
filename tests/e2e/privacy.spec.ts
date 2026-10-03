import { expect, test } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

test("privacy center audits source revocation, matching pause, export, and deletion confirmation", async ({ page }, testInfo) => {
  await useIdentity(page, `privacy-${testInfo.project.name}-${Date.now()}`);
  const projectSlug=`privacy-${testInfo.project.name.replaceAll("_","-")}-${Date.now()}`;
  await page.goto("/onboarding/manual");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.evaluate(async (slug) => {
    const send = async (url: string, body: unknown, method = "POST") => {const response=await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });if(!response.ok)throw new Error(`${url}:${response.status}:${await response.text()}`);};
    await send("/api/connected-apps", { sources: [{ appId: "github", displayName: "GitHub", category: "Projects and code", accessMode: "ask_each_time" }], completeStep: false });
    await send("/api/projects",{slug,title:"Privacy Project",summary:"A real project controlled from the privacy center.",audience:"private",allowMatching:false,status:"active",stage:"building",links:[],taxonomy:[]});
  },projectSlug);
  await page.goto("/settings/privacy");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await expect(page).toHaveTitle(/Privacy center/);
  await expect(page.getByRole("heading", { name: "Your profile and privacy" })).toBeVisible();
  await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
  await expect(page.getByText("Privacy Project",{exact:true})).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("button", { name: "Remove source" }).click();
  await expect(page.getByText("No active source policies")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Source revoked and its active signals removed from future matching.");
  await page.getByRole("button", { name: "Pause matching" }).click();
  await expect(page.getByRole("status")).toContainText("Privacy setting updated");
  await expect(page.getByRole("link", { name: "Download my data" })).toHaveAttribute("href", "/api/privacy/export");
  const exportResult=await page.evaluate(async()=>{const response=await fetch("/api/privacy/export");return{status:response.status,payload:await response.json() as {schema?:string;projects?:unknown[];sourcePolicies?:unknown[]}}});
  expect(exportResult.status).toBe(200);
  expect(exportResult.payload.schema).toBe("buildmates-account-export/v1");
  expect(exportResult.payload.projects).toHaveLength(1);
  expect(exportResult.payload.sourcePolicies).toHaveLength(1);
  const deletion = page.getByRole("button", { name: "Delete account" });
  await expect(deletion).toBeDisabled();
  await page.getByLabel("Type DELETE BUILDMATES").fill("DELETE BUILDMATES");
  await expect(deletion).toBeEnabled();
  await page.getByRole("button",{name:"Delete project"}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Delete project"}).click();
  await expect(page.getByText("No active projects")).toBeVisible();
  await assertNoOverflow(page);
  await page.screenshot({ path: test.info().outputPath("privacy-center.png"), fullPage: true, caret: "initial" });
});

test("automation settings expose expiring intent, hard budget, quiet hours, liveness, and capability", async ({ page }, testInfo) => {
  await useIdentity(page, `automation-${testInfo.project.name}-${Date.now()}`);
  await page.goto("/settings/automation");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control when Buildmates looks for people" })).toBeVisible();
  await expect(page.getByLabel("Introductions per week")).toBeVisible();
  await expect(page.getByLabel("Quiet start")).toBeVisible();
  await expect(page.getByLabel("When should Work Pulse run?")).toHaveValue("twice_weekly");
  await expect(page.getByText(/What a scheduled Work Pulse does/)).toBeVisible();
  await expect(page.getByLabel(/local or device-bound sources/)).toBeVisible();
  await page.getByLabel(/local or device-bound sources/).check();
  await page.getByRole("button", { name: "Save Work Pulse preferences" }).click();
  await expect(page.getByRole("status")).toContainText("recurring task is not confirmed yet");
  await assertNoOverflow(page);
  await page.screenshot({ path: test.info().outputPath("work-pulse-settings.png"), fullPage: true, caret: "initial" });
});

async function useIdentity(page: import("@playwright/test").Page, subject: string) { await signInTestUser(page,subject);await page.evaluate(async()=>{const codeResponse=await fetch("/api/identity/link-code",{method:"POST"});const {code}=await codeResponse.json() as {code:string};const linked=await fetch("/api/testing/complete-link",{method:"POST",headers:{"content-type":"application/json","x-buildmates-e2e":"1"},body:JSON.stringify({code})});if(!linked.ok)throw new Error(`e2e_link_failed:${linked.status}:${await linked.text()}`)}); }
async function assertNoOverflow(page: import("@playwright/test").Page) { const size = await page.locator("main").evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })); expect(size.scrollWidth - size.clientWidth).toBeLessThanOrEqual(1); }
