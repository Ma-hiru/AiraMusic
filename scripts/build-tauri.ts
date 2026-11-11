/**
 * `yarn build:tauri` —— 打安装包，输出到仓库根 `dist/`，与 `yarn build`（electron-builder）对齐。
 *
 * 走官方 Tauri CLI 的 bundler（`tauri build`），由它按平台产出：
 *
 *   macOS    .app / .dmg        （如 AiraMusic-tauri-experimental_1.4.0_aarch64.dmg）
 *   Windows  .exe(NSIS) / .msi
 *   Linux    .deb / .rpm / .AppImage / .tar.gz（tar.gz 是本脚本补的免安装包）
 *
 * 跨平台说明：安装包只能在**对应系统**上打（macOS 打 dmg、Windows 打 exe/msi、
 * Linux 打 deb/rpm/AppImage），这是 Tauri 与 electron-builder 都一样的限制；
 * 想一次出全平台用 `.github/workflows/build.yml` 的矩阵构建。
 *
 * 用法：
 *   yarn build:tauri                      当前平台的完整安装包
 *   yarn build:tauri --no-deps            跳过 UI / store / agent 的子构建
 *   yarn build:tauri --debug              打 debug 版（快，体积大）
 *   yarn build:tauri --target <triple>    指定目标架构，如 x86_64-apple-darwin
 *   yarn build:tauri --open               打完打开产物（macOS）
 *   yarn build:tauri --portable           额外产出免安装目录（Linux 的 .tar.gz 总会有）
 */

import { existsSync } from "node:fs";
import { platform } from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { join, basename, relative } from "node:path";
import { cp, rm, stat, mkdir, readdir, symlink, readFile } from "node:fs/promises";

import { buildPaths, buildTarget, binaryArchitectures } from "./tauri-build-config";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TAURI_DIR = join(ROOT, "packages/app-tauri");
const DIST = join(ROOT, "dist");

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const valueOf = (flag: string) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};

const skipDeps = has("--no-deps");
const debug = has("--debug");
const openWhenDone = has("--open");
const wantPortable = has("--portable");
const targetTriple = valueOf("--target");
if (has("--target") && (!targetTriple || targetTriple.startsWith("--"))) {
  throw new Error("--target 后需要指定目标 triple");
}
const hostTriple = execFileSync("rustc", ["-vV"], { encoding: "utf8" }).match(/^host: (.+)$/m)?.[1];
if (!hostTriple) throw new Error("无法读取 Rust 工具链的 host triple");
const explicitTarget = targetTriple ?? process.env["CARGO_BUILD_TARGET"];
const target = buildTarget(platform, hostTriple, explicitTarget);
const cargoTargetDir = (manifest: string) => {
  const metadata = execFileSync(
    "cargo",
    ["metadata", "--no-deps", "--format-version", "1", "--manifest-path", manifest],
    {
      cwd: ROOT,
      encoding: "utf8"
    }
  );
  return (JSON.parse(metadata) as { target_directory: string }).target_directory;
};
const hostTargetDir = cargoTargetDir(join(TAURI_DIR, "Cargo.toml"));
const paths = buildPaths(hostTargetDir, target.triple, debug, explicitTarget);
const agentTargetDir = cargoTargetDir(join(ROOT, "packages/agent/Cargo.toml"));

// 依赖的常规构建和测试在宿主架构运行；目标架构的二进制随后单独编译。
const hostTarget = buildTarget(platform, hostTriple);
const hostEnv = { CARGO_BUILD_TARGET: undefined, GOOS: hostTarget.goos, GOARCH: hostTarget.goarch };

function log(step: string, message = "") {
  console.log(`\x1b[36m[build:tauri]\x1b[0m ${step}${message ? ` ${message}` : ""}`);
}

function fail(message: string): never {
  console.error(`\x1b[31m[build:tauri] ${message}\x1b[0m`);
  process.exit(1);
}

function run(
  command: string,
  commandArgs: string[],
  label: string,
  env: Record<string, string | undefined> = {}
) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    log(label, `→ ${command} ${commandArgs.join(" ")}`);
    // Windows 的 yarn.cmd 不能直接交给 spawn；复用当前 Yarn 的 JS 入口。
    const corepackRoot = process.env["COREPACK_ROOT"];
    const yarnPath = corepackRoot
      ? join(corepackRoot, "dist/yarn.js")
      : process.env["npm_execpath"];
    if (command === "yarn" && platform === "win32") {
      if (!yarnPath || !/\.[cm]?js$/.test(yarnPath)) {
        reject(new Error("无法定位 Yarn 的 JS 入口，请通过 Corepack 运行 yarn build:tauri"));
        return;
      }
      commandArgs = [yarnPath, ...commandArgs];
      command = process.execPath;
    }
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      stdio: "inherit",
      env: Object.assign({}, process.env, env, { FORCE_COLOR: "1" })
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        log(label, `完成（${((Date.now() - started) / 1000).toFixed(1)}s）`);
        resolve();
      } else {
        reject(new Error(`${label} 失败，退出码 ${code}`));
      }
    });
  });
}

async function ensureArtifact(path: string, hint: string) {
  if (!existsSync(path)) {
    fail(`缺少构建产物：${path}\n  先跑 ${hint}（或去掉 --no-deps 让本脚本代劳）`);
  }
}

async function readTauriConf() {
  const raw = await readFile(join(TAURI_DIR, "tauri.conf.json"), "utf-8");
  const conf = JSON.parse(raw) as { version?: string; productName?: string };
  return {
    productName: conf.productName ?? "AiraMusic",
    version: conf.version ?? "0.0.0"
  };
}

/** 各平台的 bundle 目标（`tauri build --bundles`），tar.gz 后面自己补 */
function bundleTargets(): string {
  switch (platform) {
    case "darwin":
      // dmg 由本脚本用 hdiutil 生成：Tauri 的 dmg 步骤要用 AppleScript 调 Finder
      // 排布图标，在没有「自动化」权限的环境会直接失败（-10004）
      return "app";
    case "win32":
      return "nsis,msi";
    case "linux":
      return "deb,rpm,appimage";
    default:
      fail(`不支持的平台：${platform}`);
  }
}

/** 目标架构名（和 Tauri 的产物命名保持一致：aarch64 / x86_64 / x64） */
function archName(): string {
  return target.arch;
}

/**
 * 自己生成 dmg（`hdiutil`，等价 electron-builder 的 dmg-builder）。
 *
 * 目录里放 `AiraMusic.app` + `Applications` 软链，用户拖进去即可安装。
 * 不调 Finder，因此不需要「自动化」权限，CI 里也能跑。
 */
async function buildDmg(appPath: string, conf: { version: string; productName: string }) {
  const arch = archName();
  const dmg = join(DIST, `${conf.productName}_${conf.version}_${arch}.dmg`);
  const staging = join(DIST, ".dmg-staging");

  await rm(staging, { recursive: true, force: true });
  await rm(dmg, { force: true });
  await mkdir(staging, { recursive: true });
  await cp(appPath, join(staging, `${conf.productName}.app`), { recursive: true });
  await symlink("/Applications", join(staging, "Applications"));

  await run(
    "hdiutil",
    ["create", "-volname", conf.productName, "-srcfolder", staging, "-ov", "-format", "UDZO", dmg],
    "dmg"
  );
  await rm(staging, { recursive: true, force: true });
  return dmg;
}

/** 递归找指定后缀的产物 */
async function findArtifacts(root: string, extensions: string[]): Promise<string[]> {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (
        extensions.some((ext) => entry.name.endsWith(ext)) &&
        // Tauri 的 dmg 脚本失败时会留下 `rw.<pid>.*.dmg` 临时镜像，别当产物收集
        !/^rw\.\d+\./.test(entry.name)
      ) {
        found.push(full);
      }
    }
  };
  await walk(root);
  return found;
}

async function sizeOf(path: string) {
  const info = await stat(path);
  return `${(info.size / 1024 / 1024).toFixed(1)} MiB`;
}

/**
 * 免安装目录（Linux 的 tar.gz、其它平台的 `--portable`）。
 *
 * 布局与宿主运行时查找一致：二进制同级放 `bin/` 与 `ui/`。
 */
async function buildPortable(conf: { productName: string }) {
  const hostBinary = join(paths.output, `aira-music-tauri${target.extension}`);
  await ensureArtifact(hostBinary, "yarn build:tauri");

  const dir = join(DIST, `${conf.productName}-${platform}-${archName()}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, "bin"), { recursive: true });

  await cp(hostBinary, join(dir, `${conf.productName}${target.extension}`));
  for (const name of ["aira-music-cache", "agent"]) {
    const binary = `${name}${target.extension}`;
    await cp(join(paths.sidecars, binary), join(dir, "bin", binary));
  }
  await cp(join(ROOT, "packages/ui/dist"), join(dir, "ui"), { recursive: true });

  if (platform === "linux") {
    const tarball = `${dir}.tar.gz`;
    await rm(tarball, { force: true });
    await run("tar", ["-czf", tarball, "-C", DIST, basename(dir)], "tar.gz");
    return tarball;
  }
  return dir;
}

async function checkBinary(path: string, expected: string[]) {
  await ensureArtifact(path, "yarn build:tauri（不带 --no-deps）");
  const actual = binaryArchitectures(await readFile(path));
  if (expected.some((arch) => !actual.includes(arch))) {
    fail(`${path} 的架构是 ${actual.join(", ") || "未知"}，需要 ${expected.join(", ")}`);
  }
}

async function prepareSidecars() {
  await mkdir(paths.sidecars, { recursive: true });
  for (const triple of target.rustTargets) {
    const part = buildTarget(platform, hostTriple!, triple);
    const directory =
      target.rustTargets.length === 1 ? paths.sidecars : join(paths.sidecars, part.arch);
    await mkdir(directory, { recursive: true });
    const agent = join(directory, `agent${target.extension}`);
    const store = join(directory, `aira-music-cache${target.extension}`);
    if (triple === hostTriple) {
      const nativeAgent = join(ROOT, `packages/agent/agent${target.extension}`);
      const nativeStore = join(ROOT, `packages/store/dist/aira-music-cache${target.extension}`);
      await checkBinary(nativeAgent, [part.arch]);
      await checkBinary(nativeStore, [part.arch]);
      await cp(nativeAgent, agent);
      await cp(nativeStore, store);
    } else if (!skipDeps) {
      await run(
        "cargo",
        ["build", "--release", "--manifest-path", "packages/agent/Cargo.toml", "--target", triple],
        `agent ${part.arch}`,
        { CARGO_BUILD_TARGET: undefined, CARGO_TARGET_DIR: agentTargetDir }
      );
      await cp(join(agentTargetDir, triple, "release", `agent${target.extension}`), agent);
      await run(
        "go",
        [
          "-C",
          "packages/store",
          "build",
          "-trimpath",
          "-ldflags",
          "-s -w -buildid=",
          "-o",
          store,
          "main.go"
        ],
        `store ${part.arch}`,
        { CGO_ENABLED: "0", GOOS: part.goos, GOARCH: part.goarch }
      );
    }
    await checkBinary(agent, [part.arch]);
    await checkBinary(store, [part.arch]);
  }
  if (target.rustTargets.length > 1) {
    for (const name of ["agent", "aira-music-cache"]) {
      const inputs = target.rustTargets.map((triple) =>
        join(paths.sidecars, triple.split("-")[0]!, name)
      );
      const output = join(paths.sidecars, name);
      await run("lipo", ["-create", ...inputs, "-output", output], `${name} universal`);
      await checkBinary(output, ["aarch64", "x86_64"]);
    }
  }
}

async function main() {
  const started = Date.now();
  const conf = await readTauriConf();

  // 1. 前置产物：UI（含 wasm）、store、agent
  if (skipDeps) {
    await ensureArtifact(join(ROOT, "packages/ui/dist/index.html"), "yarn build:ui");
  } else {
    await run("yarn", ["workspace", "@mahiru/wasm", "build"], "wasm", hostEnv);
    await run("yarn", ["build:agent"], "agent", { ...hostEnv, CARGO_TARGET_DIR: agentTargetDir });
    await run("yarn", ["build:ui"], "ui", hostEnv);
    await run("yarn", ["build:store"], "store", hostEnv);
  }
  await prepareSidecars();

  // 2. 打包：交给官方 bundler（它会先 cargo build --release，再出安装包）
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await rm(paths.bundle, { recursive: true, force: true });

  const resources: Record<string, string> = {};
  for (const name of ["agent", "aira-music-cache"]) {
    const binary = `${name}${target.extension}`;
    resources[relative(TAURI_DIR, join(paths.sidecars, binary)).replaceAll("\\", "/")] =
      `bin/${binary}`;
  }
  // CLI 生成的资源映射随目标架构切换，不修改共享配置或覆盖开发用的子进程。
  const cliArgs = [
    "tauri",
    "build",
    "--features",
    "custom-protocol",
    "--config",
    JSON.stringify({ bundle: { resources } }),
    "--bundles",
    bundleTargets()
  ];
  if (debug) cliArgs.push("--debug");
  if (targetTriple) cliArgs.push("--target", targetTriple);
  await run("yarn", cliArgs, "bundle", { CARGO_TARGET_DIR: hostTargetDir });

  // 3. 收集产物到 dist/
  const bundleDir = paths.bundle;
  const artifacts = await findArtifacts(bundleDir, [
    ".dmg",
    ".exe",
    ".msi",
    ".deb",
    ".rpm",
    ".AppImage"
  ]);
  // macOS 的 .app 不在收集后缀里（dmg 后面自己生成），所以这里先不判空
  for (const file of artifacts) {
    const dest = join(DIST, basename(file));
    await cp(file, dest);
    log("产物", `${dest}（${await sizeOf(dest)}）`);
  }

  // 4. macOS：自己出 dmg（CLI 只产 .app）
  if (platform === "darwin") {
    const appPath = join(bundleDir, "macos", `${conf.productName}.app`);
    if (!existsSync(appPath)) fail(`找不到 .app：${appPath}`);
    const dmg = await buildDmg(appPath, conf);
    log("产物", `${dmg}（${await sizeOf(dmg)}）`);
    artifacts.push(dmg);
  }

  if (artifacts.length === 0) fail(`没有在 ${bundleDir} 找到安装包`);

  // 5. Linux 一定要 tar.gz；其它平台按 --portable 决定
  if (platform === "linux" || wantPortable) {
    const portable = await buildPortable(conf);
    if (portable) log("免安装包", portable);
  }

  // 6. macOS 打开 dmg 所在目录
  if (openWhenDone && platform === "darwin") {
    await run("open", [DIST], "打开产物目录");
  }

  log(
    "完成",
    `共 ${artifacts.length} 个安装包 → ${DIST}（${((Date.now() - started) / 1000 / 60).toFixed(1)}min）`
  );
  for (const file of artifacts) log("  ·", basename(file));
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
