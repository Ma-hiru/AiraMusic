import { defineConfig } from "tsup";

// noinspection JSUnusedGlobalSymbols 禁用webstorm的未使用默认导出警告
export default defineConfig([
  {
    entry: ["src/main.ts"],
    outDir: "../dist/app",
    format: ["esm"],
    platform: "node",
    target: "node20",
    sourcemap: true,
    clean: true,
    dts: false,
    external: ["electron", "esbuild", "node:*"],
    noExternal: ["@mahiru/err"],
    minify: true
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
    noExternal: ["@mahiru/err"]
  }
]);
