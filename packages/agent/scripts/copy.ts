import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const metadata = JSON.parse(
  execFileSync("cargo", ["metadata", "--no-deps", "--format-version", "1"], {
    cwd: root,
    encoding: "utf8"
  })
) as { target_directory: string };
const exec_path = join(
  metadata.target_directory,
  process.env["CARGO_BUILD_TARGET"] ?? "",
  "release",
  process.platform === "win32" ? "agent.exe" : "agent"
);

await copyFile(exec_path, join(root, process.platform === "win32" ? "agent.exe" : "agent"));
