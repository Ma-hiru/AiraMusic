import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

function loadEnv() {
  const envFile = ".env";
  const env: Record<string, string> = {};
  const data = readFileSync(envFile, "utf-8");
  const lines = data.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const [key, value] = trimmedLine.split("=");
      if (!key || !value) {
        throw new Error("environment variable is required");
      }
      env[key] = value;
    }
  }
  return env as unknown as ENV;
}

function genDevDefine() {
  const result: Record<string, any> = {};
  Object.entries(loadEnv()).forEach(([key, value]) => {
    const defKey = `process.env.${key}`;
    result[defKey] = value;
  });
  return result;
}

// noinspection JSUnusedGlobalSymbols
export default defineConfig([
  {
    entry: ["src/main.ts"],
    outDir: "../dist/app",
    format: ["esm"],
    platform: "node",
    target: "node20",
    sourcemap: true,
    clean: false,
    dts: false,
    external: ["electron", "esbuild", "node:*", "window"],
    noExternal: ["@mahiru/log", "@mahiru/store"],
    minify: true,
    esbuildOptions: (options) => {
      options.define = {
        ...(options.define || {}),
        ...(function () {
          const env = genDevDefine();
          console.log("Define env:", env);
          return env;
        })()
      };
      return options;
    }
  },
  {
    entry: ["src/preload/index.ts"],
    outDir: "../dist/preload",
    format: ["cjs"],
    platform: "node",
    target: "node20",
    sourcemap: true,
    clean: true,
    dts: false,
    minify: true,
    external: ["electron", "esbuild", "node:*"],
    noExternal: ["@mahiru/log"]
  }
]);
