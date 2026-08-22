import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile } from "node:fs/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const exec_path = join(
  root,
  "target",
  "release",
  process.platform === "win32" ? "agent.exe" : "agent"
);

await copyFile(exec_path, join(root, "agent"));
