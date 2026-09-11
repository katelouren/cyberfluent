import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { envelopeSchema } from "../../src/lib/api";

test("two free written answers traverse browser → FastAPI → OpenAI", async ({
  page,
  request,
}) => {
  const health = await request.get("http://localhost:8000/health");
  expect(
    (await health.json()).configured,
    "Configure backend/.env before running live acceptance",
  ).toBe(true);
  await page.goto("/missoes/phishing-incident-communication");
  await page.getByRole("button", { name: "Começar Spot the Risk" }).click();
  for (const c of (await page.getByRole("checkbox").all()).slice(0, 3))
    await c.check();
  await page.getByRole("button", { name: "Verificar pistas" }).click();
  await page.getByRole("button", { name: "Orientar Alex em inglês" }).click();
  const answers = [
    "You need change your password and report the email.",
    "Hi Alex, please do not use that link again. Change your password on the official website and report the message to our security team.",
  ];
  const records = [];
  for (let i = 0; i < answers.length; i++) {
    await page.getByLabel("Sua orientação em inglês").fill(answers[i]);
    const pending = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/tutor/feedback") &&
        r.request().method() === "POST",
      { timeout: 50000 },
    );
    await page.getByRole("button", { name: "Enviar para a tutora" }).click();
    const response = await pending;
    expect(
      response.status(),
      "Live provider must succeed, demo is not acceptance",
    ).toBe(200);
    const result = envelopeSchema.parse(await response.json());
    expect(result.ai_mode).toBe("live");
    await expect(
      page.getByRole("region", { name: "Feedback da tutora" }),
    ).toContainText("Feedback personalizado por IA · live");
    records.push({
      request_id: result.request_id,
      ai_mode: result.ai_mode,
      prompt_version: result.prompt_version,
      corrected_answer: result.feedback.corrected_answer,
      quick_explanation: result.feedback.quick_explanation,
      deep_explanation: result.feedback.deep_explanation,
      language_errors: result.feedback.language_errors,
      technical_feedback: result.feedback.technical_feedback,
      professional_feedback: result.feedback.professional_feedback,
    });
    await page.screenshot({
      path: `docs/evidence/live-${i + 1}.png`,
      fullPage: true,
    });
  }
  expect(records[0].corrected_answer).not.toBe(records[1].corrected_answer);
  expect(
    records[0].language_errors.some((e) => e.original.includes("need")),
  ).toBe(true);
  await page.getByRole("button", { name: "Praticar sem consultar" }).click();
  await page.getByLabel("Palavra que completa a frase").fill("to");
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await expect(
    page.getByRole("heading", { name: "Prática concluída" }),
  ).toBeVisible();
  writeFileSync(
    "docs/evidence/live-check.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        scenario: "Two synthetic, nonpersonal phishing instructions",
        records,
      },
      null,
      2,
    ) + "\n",
  );
});
