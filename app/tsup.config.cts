import { defineConfig } from "tsup";
import { loadEnv } from "../scripts/env";

function genDefine(mode: string) {
  return Object.entries(loadEnv(mode)).reduce(
    (result, [key, value]) => {
      result[`process.env.${key}`] = JSON.stringify(value);
      return result;
    },
    <Record<string, string>>{}
  );
}

// noinspection JSUnusedGlobalSymbols
export default defineConfig((options) => {
  const mode = options.watch ? "development" : "production";
  return [
    {
      entry: ["src/main.ts"],
      outDir: "dist/app",
      format: ["esm"],
      platform: "node",
      target: "node20",
      sourcemap: mode === "development",
      clean: mode === "production",
      dts: false,
      external: ["electron", "esbuild", "esbuild/*", "node:*", "window"],
      noExternal: ["@mahiru/log", "@mahiru/store"],
      minify: true,
      esbuildOptions: (esbuildOptions) => {
        esbuildOptions.define = {
          ...(esbuildOptions.define || {}),
          ...genDefine(mode)
        };
        return esbuildOptions;
      }
    },
    {
      entry: ["src/preload/index.ts"],
      outDir: "dist/preload",
      format: ["cjs"],
      platform: "node",
      target: "node20",
      sourcemap: true,
      clean: true,
      dts: false,
      minify: true,
      external: ["electron", "esbuild", "esbuild/*", "node:*", "window"],
      noExternal: ["@mahiru/log"]
    }
  ];
});
