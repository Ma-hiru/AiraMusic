import AppEnv from "../../scripts/env";
import { defineConfig } from "vitest/config";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // packages/app 不需要使用vite打包，所以不会 "@" 别名冲突
      "@mahiru/app": join(__dirname, "src"), // vitest
      "@": join(__dirname, "tests") // vitest
    }
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx,cts,mts,js,cjs,mjs}"],
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"]
  },
  define: loadEnv()
});

function loadEnv() {
  AppEnv.setEnvPath(join(__dirname, "../../"));
  const loadedEnv = AppEnv.load("test");
  const defineEnv: Record<string, string> = {};
  for (const k in loadedEnv) {
    defineEnv[`import.meta.env.${k}`] = JSON.stringify(loadedEnv[k]);
    defineEnv[`process.env.${k}`] = JSON.stringify(loadedEnv[k]);
  }
  return defineEnv;
}
