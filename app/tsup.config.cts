import { defineConfig } from "tsup";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { loadEnv } from "../scripts/env";

const require = createRequire(__filename);

type PackageJSON = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

function resolvePackageJSON(packageName: string) {
  try {
    return require.resolve(`${packageName}/package.json`);
  } catch {
    const entryPath = require.resolve(packageName);
    let cursor = dirname(entryPath);
    while (true) {
      const packagePath = join(cursor, "package.json");
      if (existsSync(packagePath)) return packagePath;
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    throw new Error(`Cannot resolve package.json for ${packageName}`);
  }
}

function collectDependencies(packageNames: string[]) {
  const queue = [...packageNames];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const packageName = queue.pop();
    if (!packageName || visited.has(packageName)) continue;

    visited.add(packageName);
    const packagePath = resolvePackageJSON(packageName);
    const pkg = <PackageJSON>JSON.parse(readFileSync(packagePath, "utf8"));
    Object.keys({ ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) }).forEach(
      (depName) => {
        if (!visited.has(depName)) queue.push(depName);
      }
    );
  }

  return Array.from(visited);
}

const proxyRuntimeDependencies = collectDependencies(["express", "express-http-proxy"]);

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
      minify: mode === "production",
      dts: false,
      external: ["electron", "esbuild", "esbuild/*", "node:*", "window"],
      noExternal: ["@mahiru/log", "@mahiru/store", ...proxyRuntimeDependencies],
      esbuildOptions: (esbuildOptions) => {
        const existingBanner =
          typeof esbuildOptions.banner?.js === "string" ? `${esbuildOptions.banner.js}\n` : "";

        esbuildOptions.define = {
          ...(esbuildOptions.define || {}),
          ...genDefine(mode)
        };
        esbuildOptions.banner = {
          ...(esbuildOptions.banner || {}),
          js: `${existingBanner}import { createRequire } from \"node:module\"; const require = createRequire(import.meta.url);`
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
      dts: false,
      sourcemap: mode === "development",
      clean: mode === "production",
      minify: mode === "production",
      external: ["electron", "esbuild", "esbuild/*", "node:*", "window"],
      noExternal: ["@mahiru/log"]
    }
  ];
});
