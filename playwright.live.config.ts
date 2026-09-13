import { defineConfig, devices } from "@playwright/test";
// Opt-in: three real AI requests and hosted Supabase authentication/persistence.
export default defineConfig({
  testDir: "./tests/live",
  workers: 1,
  timeout: 300000,
  expect: { timeout: 20000 },
  reporter: "line",

  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3100",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: [
    {
      command: "npm run start -- --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
    },
    {
      command:
        "backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000",
      url: "http://localhost:8000/health",
      reuseExistingServer: false,
      env: {
        FRONTEND_ORIGIN: "http://localhost:3100",
        AI_DEMO_FALLBACK_ENABLED: "false",
      },
    },
  ],
});
