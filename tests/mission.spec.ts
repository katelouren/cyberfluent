import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function demo(page: Page) {
  await page.goto("/login");
  await page.getByText("Plano B: explorar sem conta ou sem IA").click();
  await page
    .getByRole("button", { name: "Entrar conscientemente no modo demo" })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Salvar e abrir trilha" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu mapa de missões." }),
  ).toBeVisible();
}
async function games(page: Page, slug: string) {
  await page.goto(`/missoes/${slug}`);
  await page.getByRole("button", { name: /Começar / }).click();
  if (slug === "daily-standup") {
    for (const name of [
      "Yesterday, I fixed the login bug.",
      "Today, I will write tests.",
      "I need access to staging. Can someone help?",
    ])
      await page.getByRole("button", { name, exact: true }).click();
  } else if (slug === "bug-report") {
    const selects = await page.locator(".mission-content select").all();
    for (const [i, value] of ["expected", "actual", "impact"].entries())
      await selects[i].selectOption(value);
  } else {
    for (const c of (await page.getByRole("checkbox").all()).slice(0, 3))
      await c.check();
  }
  await page
    .getByRole("button", { name: "Verificar resposta da atividade" })
    .click();
  await page.getByRole("button", { name: "Continuar missão" }).click();
  const correct =
    slug === "daily-standup"
      ? "I am blocked by missing"
      : slug === "bug-report"
        ? "Click Save, observe"
        : "Open the official website";
  await page.getByRole("radio", { name: new RegExp(correct) }).check();
  await page
    .getByRole("button", { name: "Verificar resposta da atividade" })
    .click();
  await page.getByRole("button", { name: "Continuar missão" }).click();
}
test("home identity and mobile layout", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Cyber.fluent/);
  await page.getByRole("button", { name: /Report it through/ }).click();
  await expect(page.getByText(/Boa decisão/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("home-mobile.png"),
    fullPage: true,
  });
});
for (const slug of [
  "daily-standup",
  "bug-report",
  "phishing-incident-communication",
]) {
  test(`${slug}: two games, free production, explicit demo, recall and session progress`, async ({
    page,
  }, testInfo) => {
    await demo(page);
    await games(page, slug);
    await page
      .getByLabel("Sua orientação em inglês")
      .fill("You need change your password and report the email.");
    const pending = page.waitForResponse(
      (r) =>
        r.url().endsWith("tutor/feedback") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Ver exemplo demo" }).click();
    const response = await pending;
    expect(response.status()).toBe(200);
    expect((await response.json()).ai_mode).toBe("demo");
    await expect(
      page.getByRole("region", { name: "Feedback da tutora" }),
    ).toContainText("Modo demo");
    if (slug === "phishing-incident-communication")
      await expect(
        page.getByText("To não significa necessidade", { exact: false }),
      ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${slug}-demo.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Praticar sem consultar" }).click();
    await expect(
      page.getByText("To não significa necessidade", { exact: false }),
    ).toHaveCount(0);
    await page
      .getByLabel("Palavra que completa a frase")
      .fill(
        slug === "daily-standup"
          ? "write"
          : slug === "bug-report"
            ? "save"
            : "to",
      );
    await page
      .getByRole("button", { name: "Verificar resposta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Prática concluída" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Ver progresso" }).click();
    await expect(page.getByText("Total:", { exact: false })).toContainText(
      "0 XP",
    );
    await page.reload();
    await expect(page.getByText("Total:", { exact: false })).toContainText(
      "1 missões praticadas",
    );
    await page.goto("/revisao");
    await expect(
      page.getByText("Próxima prática:", { exact: false }),
    ).toBeVisible();
  });
}
test("keyboard, axe and small-screen critical flows", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para conteúdo" }),
  ).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await demo(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await games(page, "phishing-incident-communication");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
});
test("wrong selection and malformed feedback remain recoverable", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/missoes/phishing-incident-communication");
  await page.getByRole("button", { name: "Começar Spot the Risk" }).click();
  await page.getByRole("checkbox").last().check();
  await page
    .getByRole("button", { name: "Verificar resposta da atividade" })
    .click();
  await expect(page.getByText("Revise sua resposta")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar missão" }),
  ).toHaveCount(0);
  await games(page, "phishing-incident-communication");
  await page
    .getByLabel("Sua orientação em inglês")
    .fill("You need change your password and report the email.");
  await page.route("**/api/v1/tutor/feedback", (r) =>
    r.fulfill({ json: { ai_mode: "live", feedback: {} } }),
  );
  await page.getByRole("button", { name: "Ver exemplo demo" }).click();
  await expect(page.locator(".notice[role=alert]")).toBeVisible();
  await expect(page.getByLabel("Sua orientação em inglês")).toHaveValue(
    "You need change your password and report the email.",
  );
  await expect(
    page.getByRole("region", { name: "Feedback da tutora" }),
  ).toHaveCount(0);
});
test("companion allowlist and original comprehension activity", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/academy-companion");
  await page.getByRole("radio", { name: /A known, verified/ }).check();
  await page.getByRole("button", { name: "Verificar compreensão" }).click();
  await expect(page.getByText("✓ Correto.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continuar na Academy oficial/ }),
  ).toHaveAttribute(
    "href",
    "https://www.paloaltonetworks.com/services/education/academy",
  );
});
