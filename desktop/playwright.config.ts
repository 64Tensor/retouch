// The app's tests drive the built app (pnpm build first) through Playwright's Electron support.

import { defineConfig } from "@playwright/test";

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? "github" : "list",
  use: { trace: "retain-on-failure" },
});
