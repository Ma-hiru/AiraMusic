import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const artifactName =
  process.platform === "win32"
    ? "native.dll"
    : process.platform === "darwin"
      ? "libnative.dylib"
      : "libnative.so";

const source = path.join(__dirname, "..", "target", "release", artifactName);
const target = path.join(__dirname, "..", "index.node");

if (!existsSync(source)) {
  throw new Error(`Cargo artifact not found: ${source}`);
}

copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
