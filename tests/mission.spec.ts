import { test, expect, type Page } from "@playwright/test";
async function produce(page: Page) {
  await page.goto("/missoes/phishing-incident-communication");
  await page.getByRole("button", { name: "Começar Spot the Risk" }).click();
  for (const c of (await page.getByRole("checkbox").all()).slice(0, 3))
    await c.check();
  await page.getByRole("button", { name: "Verificar pistas" }).click();
  await expect(page.getByText("Três pistas identificadas")).toBeVisible();
  await page.getByRole("button", { name: "Orientar Alex em inglês" }).click();
  await page
    .getByLabel("Sua orientação em inglês")
    .fill("You need change your password and report the email.");
}
test("home own identity, playable preview, mobile layout", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cyber.fluent/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.getByRole("button", { name: /Report it through/ }).click();
  await expect(page.getByText(/Boa decisão/)).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: /Start your first mission/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/evidence/home-mobile.png",
    fullPage: true,
  });
});
test("real FastAPI transport, unavailable live, explicit demo and recall", async ({
  page,
}) => {
  await produce(page);
  const request = page.waitForRequest(
    (r) => r.url().includes("/api/v1/tutor/feedback") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Enviar para a tutora" }).click();
  expect((await request).postDataJSON().demo).toBe(false);
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "IA indisponível",
  );
  await expect(
    page.getByText("Feedback personalizado por IA · live", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Usar exemplo demo conscientemente" })
    .click();
  await expect(
    page.getByRole("region", { name: "Feedback da tutora" }),
  ).toContainText("Modo demo");
  await expect(
    page.getByText("To não significa necessidade", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/mission-demo.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Praticar sem consultar" }).click();
  await expect(
    page.getByText("To não significa necessidade", { exact: false }),
  ).toHaveCount(0);
  await page.getByLabel("Palavra que completa a frase").fill("to");
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Prática concluída" }),
  ).toBeVisible();
});
test("wrong risk selection stays in minigame; keyboard access", async ({
  page,
}) => {
  await page.goto("/missoes/phishing-incident-communication");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para conteúdo" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Começar Spot the Risk" }).click();
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Verificar pistas" }).click();
  await expect(page.getByText("Revise sua seleção")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Orientar Alex em inglês" }),
  ).toHaveCount(0);
});
test("invalid server JSON is recoverable without false live", async ({
  page,
}) => {
  await produce(page);
  await page.route("**/api/v1/tutor/feedback", (route) =>
    route.fulfill({ json: { ai_mode: "live", feedback: {} } }),
  );
  await page.getByRole("button", { name: "Enviar para a tutora" }).click();
  await expect(page.locator(".notice[role=alert]")).toBeVisible();
  await expect(page.getByLabel("Sua orientação em inglês")).toHaveValue(
    "You need change your password and report the email.",
  );
  await expect(
    page.getByRole("region", { name: "Feedback da tutora" }),
  ).toHaveCount(0);
});
