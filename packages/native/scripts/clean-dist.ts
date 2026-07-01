import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = path.join(__dirname, "..");

for (const target of ["dist-types", "index.node"]) {
  rmSync(path.join(root, target), { force: true, recursive: true });
}
