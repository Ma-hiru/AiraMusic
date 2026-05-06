import AppEnv from "../../scripts/env";
import { defineConfig } from "vitest/config";
import { join } from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,cts,mts,js,cjs,mjs}"],
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"]
  },
  define: loadEnv()
});

function loadEnv() {
  AppEnv.setEnvPath(join(process.cwd(), "../../"));
  const loadedEnv = AppEnv.load("test");
  const defineEnv: Record<string, string> = {};
  for (const k in loadedEnv) {
    defineEnv[`import.meta.env.${k}`] = JSON.stringify(loadedEnv[k]);
    defineEnv[`process.env.${k}`] = JSON.stringify(loadedEnv[k]);
  }
  return defineEnv;
}
