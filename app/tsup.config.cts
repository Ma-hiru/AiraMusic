const { defineConfig } = require("tsup");

module.exports = defineConfig([
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
    external: ["electron", "esbuild", "node:*"]
  }
]);
