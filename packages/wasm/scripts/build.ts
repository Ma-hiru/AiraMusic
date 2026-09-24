import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const args = ["build", "--target", "web", "--out-dir", "pkg", "--release"];

// wasm-pack 0.15.0 使用 wasm-opt 时没有 Windows ARM64 版
if (process.platform === "win32" && process.arch === "arm64") {
  args.push("--no-opt");
}

execFileSync("wasm-pack", args, {
  cwd: fileURLToPath(root),
  stdio: "inherit"
});

rmSync(new URL("pkg/package.json", root), { force: true });
