import { defineConfig, devices } from "@playwright/test";
const port = process.env.EVOLITH_TEST_PORT || "8000";
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: origin, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROME ? { channel: "chrome" } : {}),
      },
    },
  ],
  webServer: {
    command: `${process.env.MODELFORGE_PYTHON || "python"} -m uvicorn modelforge.app:app --app-dir ../backend --host 127.0.0.1 --port ${port}`,
    url: `${origin}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { MODELFORGE_MODE: "demo", MODELFORGE_DATA_DIR: process.env.MODELFORGE_TEST_DATA_DIR || "../artifacts/e2e" },
  },
});
