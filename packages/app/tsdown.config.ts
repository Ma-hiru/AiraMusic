import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "tsdown";
import path from "node:path";

import { AppEnv } from "../../scripts/env.ts";
import { generateLogo } from "../../scripts/logo.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const genEnvDefine = (mode: string) => {
  return Object.entries(AppEnv.load(mode)).reduce(
    (result, [key, value]) => {
      result[`process.env.${key}`] = JSON.stringify(value);
      return result;
    },
    {} as Record<string, string>
  );
};

void generateLogo();

// noinspection JSUnusedGlobalSymbols
export default defineConfig((options) => {
  const mode = options.watch ? "development" : "production";
  const baseOptions: UserConfig = {
    format: ["esm"],
    platform: "node",
    target: "node20",
    sourcemap: mode === "development",
    clean: true,
    minify: true,
    dts: false,
    deps: {
      neverBundle: ["electron", "window"],
      alwaysBundle: [/^@mahiru\//]
    },
    alias: {
      "@": path.resolve(__dirname, "./src") // src
    },
    define: genEnvDefine(mode),
    banner: `
       import { createRequire as createRequireBanner } from "node:module";
       const require = createRequireBanner(import.meta.url);
    `.trim()
  };
  return [
    {
      entry: ["src/main.ts"],
      outDir: "dist/app",
      ...baseOptions
    },
    {
      entry: ["src/services/ncm/child.ts"],
      outDir: "dist/app/ncm",
      ...baseOptions
    },
    {
      entry: ["src/services/proxy/child.ts"],
      outDir: "dist/app/proxy",
      ...baseOptions
    },
    {
      entry: ["src/preload/index.ts"],
      outDir: "dist/preload",
      format: ["cjs"],
      platform: "node",
      target: "node20",
      dts: false,
      sourcemap: mode === "development",
      clean: true,
      minify: true,
      deps: {
        neverBundle: ["electron", "window"]
      }
    }
  ];
});
