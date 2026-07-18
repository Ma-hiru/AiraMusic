import { defineConfig } from "tsup";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// noinspection JSUnusedGlobalSymbols
export default defineConfig((options) => {
  const mode = options.watch ? "development" : "production";
  return [
    {
      entry: {
        index: "src/index.ts",
        model: "src/model/index.ts"
      },
      outDir: "dist",
      format: ["esm"],
      platform: "node",
      target: "node20",
      bundle: true,
      sourcemap: mode === "development",
      clean: mode === "production",
      minify: mode === "production",
      dts: false,
      external: ["electron", "esbuild", "esbuild/*", "node:*", "window"],
      noExternal: ["@mahiru/*", "openai"],
      esbuildOptions: (esbuildOptions) => {
        esbuildOptions.alias = {
          ...(esbuildOptions.alias || {}),
          "@": path.resolve(__dirname, "./src")
        };
        return esbuildOptions;
      }
    }
  ];
});
