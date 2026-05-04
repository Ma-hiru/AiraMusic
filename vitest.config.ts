import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,cts,mts,js,cjs,mjs}"],
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"]
  }
});
