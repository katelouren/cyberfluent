import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/live/**", "**/database/**"],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://localhost:3100", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
        AI_DEMO_FALLBACK_ENABLED: "true",
        FRONTEND_ORIGIN: "http://localhost:3100",
      },
    },
  ],
});
