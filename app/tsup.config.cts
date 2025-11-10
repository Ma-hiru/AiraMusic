const { defineConfig } = require("tsup");

module.exports = defineConfig([
  {
    entry: ["src/main.ts"],
    outDir: "../dist-app",
    format: ["esm"],
    skipNodeModulesBundle: true,
    sourcemap: false,
    clean: true,
    dts: true,
    external: ["electron", "esbuild"],
    minify: true
  },
  {
    entry: ["src/preload/index.ts"],
    outDir: "../dist-preload",
    format: ["cjs"],
    sourcemap: false,
    clean: true,
    dts: true,
    external: ["electron", "esbuild"],
    minify: true
  }
]);
