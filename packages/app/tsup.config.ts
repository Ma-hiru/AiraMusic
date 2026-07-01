import { fileURLToPath } from "node:url";
import { defineConfig, type Options } from "tsup";
import path from "node:path";

import AppEnv from "../../scripts/env";
import { generateLogo } from "../../scripts/logo";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

void generateLogo();

function genDefine(mode: string) {
  return Object.entries(AppEnv.load(mode)).reduce(
    (result, [key, value]) => {
      result[`process.env.${key}`] = JSON.stringify(value);
      return result;
    },
    {} as Record<string, string>
  );
}

// noinspection JSUnusedGlobalSymbols
export default defineConfig((options) => {
  const mode = options.watch ? "development" : "production";
  const baseOptions: Options = {
    format: ["esm"],
    platform: "node",
    target: "node20",
    bundle: true,
    sourcemap: mode === "development",
    clean: mode === "production",
    minify: mode === "production",
    dts: false,
    external: ["electron", "esbuild", "esbuild/*", "node:*", "window"],
    noExternal: ["@mahiru/*"],
    esbuildOptions: (esbuildOptions) => {
      esbuildOptions.alias = {
        ...(esbuildOptions.alias || {}),
        "@": path.resolve(__dirname, "./src") // src
      };
      esbuildOptions.define = {
        ...(esbuildOptions.define || {}),
        ...genDefine(mode)
      };
      esbuildOptions.banner = {
        ...(esbuildOptions.banner || {}),
        js: [
          "import { createRequire as createRequireBanner } from 'node:module';",
          "const require = createRequireBanner(import.meta.url);",
          esbuildOptions.banner?.js || ""
        ]
          .filter(Boolean)
          .join("\n")
      };
      return esbuildOptions;
    }
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
      clean: mode === "production",
      minify: mode === "production",
      external: ["electron", "esbuild", "esbuild/*", "node:*", "window"]
    }
  ];
});
