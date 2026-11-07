import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "packages/ui/vite.config.ts",
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.{ts,tsx,cts,mts,js,cjs,mjs}"]
        }
      }
    ]
  }
});
