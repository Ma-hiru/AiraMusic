import { join } from "node:path";

export function buildTarget(platform: NodeJS.Platform, host: string, requested = host) {
  const goPlatforms: Partial<Record<NodeJS.Platform, string>> = {
    darwin: "darwin",
    win32: "windows",
    linux: "linux"
  };
  const goos = goPlatforms[platform];
  if (!goos) throw new Error(`不支持的平台：${platform}`);
  const universal = requested === "universal-apple-darwin";
  const matchesPlatform =
    platform === "darwin"
      ? requested.endsWith("-apple-darwin")
      : platform === "win32"
        ? requested.includes("-windows-")
        : requested.includes("-linux-");
  if (!matchesPlatform)
    throw new Error(`不能在 ${platform} 上打包 ${requested}，请在目标系统运行构建`);
  const architecture = requested.split("-")[0]!;
  const goarch = { aarch64: "arm64", x86_64: "amd64", i686: "386", armv7: "arm" }[architecture];
  if (!universal && !goarch) throw new Error(`不支持的目标架构：${requested}`);
  return {
    triple: requested,
    arch: architecture,
    goos,
    goarch,
    extension: platform === "win32" ? ".exe" : "",
    rustTargets: universal ? ["aarch64-apple-darwin", "x86_64-apple-darwin"] : [requested]
  };
}

export function buildPaths(
  targetDir: string,
  target: string,
  debug: boolean,
  explicitTarget?: string
) {
  const output = join(targetDir, explicitTarget ?? "", debug ? "debug" : "release");
  return {
    output,
    bundle: join(output, "bundle"),
    sidecars: join(targetDir, "sidecars", target)
  };
}

/** 检查实际文件头，防止 --no-deps 或残留文件把另一种架构混进安装包。 */
export function binaryArchitectures(bytes: Buffer): string[] {
  if (bytes.length < 20) return [];
  const magic = bytes.readUInt32BE(0);
  const mach = (cpu: number) => ({ 0x0100000c: "aarch64", 0x01000007: "x86_64", 7: "i686" })[cpu];
  if (magic === 0xcafebabe || magic === 0xcafebabf) {
    const count = bytes.readUInt32BE(4);
    const stride = magic === 0xcafebabf ? 32 : 20;
    if (8 + count * stride > bytes.length) return [];
    return Array.from({ length: count }, (_, i) => mach(bytes.readUInt32BE(8 + i * stride))).filter(
      (arch): arch is string => !!arch
    );
  }
  if (magic === 0xcffaedfe || magic === 0xcefaedfe) {
    const arch = mach(bytes.readUInt32LE(4));
    return arch ? [arch] : [];
  }
  if (magic === 0x7f454c46) {
    const machine = bytes[5] === 2 ? bytes.readUInt16BE(18) : bytes.readUInt16LE(18);
    const arch = { 183: "aarch64", 62: "x86_64", 3: "i686", 40: "armv7" }[machine];
    return arch ? [arch] : [];
  }
  if (bytes.toString("ascii", 0, 2) === "MZ" && bytes.length >= 64) {
    const offset = bytes.readUInt32LE(60);
    if (offset + 6 > bytes.length || bytes.readUInt32LE(offset) !== 0x4550) return [];
    const arch = { 0xaa64: "aarch64", 0x8664: "x86_64", 0x014c: "i686" }[
      bytes.readUInt16LE(offset + 4)
    ];
    return arch ? [arch] : [];
  }
  return [];
}
