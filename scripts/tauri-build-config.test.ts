import { join } from "node:path";
import { it, expect, describe } from "vitest";

import { buildPaths, buildTarget, binaryArchitectures } from "./tauri-build-config";

describe("Tauri 构建目标与产物路径", () => {
  it("按 Rust host 而非固定 ARM64 推导默认 macOS 架构", () => {
    expect(buildTarget("darwin", "x86_64-apple-darwin")).toMatchObject({
      arch: "x86_64",
      goos: "darwin",
      goarch: "amd64",
      extension: ""
    });
  });

  it("debug 包只从目标的 debug 目录收集，保留独立的架构资源目录", () => {
    const paths = buildPaths("target", "x86_64-apple-darwin", true, "x86_64-apple-darwin");
    expect(paths.output).toBe(join("target", "x86_64-apple-darwin", "debug"));
    expect(paths.bundle).toBe(join(paths.output, "bundle"));
    expect(paths.sidecars).toBe(join("target", "sidecars", "x86_64-apple-darwin"));
    expect(buildPaths("target", "aarch64-apple-darwin", false).output).toBe(
      join("target", "release")
    );
  });

  it("交叉架构构建向 Go 和 Rust 使用同一目标", () => {
    expect(buildTarget("darwin", "aarch64-apple-darwin", "x86_64-apple-darwin")).toMatchObject({
      goarch: "amd64",
      rustTargets: ["x86_64-apple-darwin"]
    });
    expect(
      buildTarget("linux", "x86_64-unknown-linux-gnu", "aarch64-unknown-linux-gnu")
    ).toMatchObject({
      goos: "linux",
      goarch: "arm64",
      rustTargets: ["aarch64-unknown-linux-gnu"]
    });
  });

  it("Windows 宿主及子进程统一使用 exe 后缀", () => {
    expect(buildTarget("win32", "x86_64-pc-windows-msvc")).toMatchObject({
      goos: "windows",
      goarch: "amd64",
      extension: ".exe"
    });
  });

  it("universal 包要求两个架构的子进程，不能混用单架构产物", () => {
    expect(
      buildTarget("darwin", "aarch64-apple-darwin", "universal-apple-darwin").rustTargets
    ).toEqual(["aarch64-apple-darwin", "x86_64-apple-darwin"]);
  });

  it("拒绝在另一种系统打安装包或使用无法映射的架构", () => {
    expect(() => buildTarget("darwin", "aarch64-apple-darwin", "x86_64-pc-windows-msvc")).toThrow(
      "目标系统"
    );
    expect(() =>
      buildTarget("linux", "x86_64-unknown-linux-gnu", "riscv64gc-unknown-linux-gnu")
    ).toThrow("架构");
  });
});

describe("检查实际的子进程文件架构", () => {
  it("识别 Mach-O ARM64 和 Intel 文件，拒绝短文件", () => {
    const bytes = Buffer.alloc(32);
    bytes.writeUInt32LE(0xfeedfacf, 0);
    bytes.writeUInt32LE(0x0100000c, 4);
    expect(binaryArchitectures(bytes)).toEqual(["aarch64"]);
    bytes.writeUInt32LE(0x01000007, 4);
    expect(binaryArchitectures(bytes)).toEqual(["x86_64"]);
    expect(binaryArchitectures(Buffer.alloc(3))).toEqual([]);
  });

  it("识别 universal Mach-O 并拒绝截断的架构表", () => {
    const bytes = Buffer.alloc(48);
    bytes.writeUInt32BE(0xcafebabe, 0);
    bytes.writeUInt32BE(2, 4);
    bytes.writeUInt32BE(0x0100000c, 8);
    bytes.writeUInt32BE(0x01000007, 28);
    expect(binaryArchitectures(bytes)).toEqual(["aarch64", "x86_64"]);
    expect(binaryArchitectures(bytes.subarray(0, 32))).toEqual([]);
  });

  it("识别 Linux ELF 和 Windows PE 的目标架构", () => {
    const elf = Buffer.alloc(32);
    elf.writeUInt32BE(0x7f454c46, 0);
    elf[5] = 1;
    elf.writeUInt16LE(183, 18);
    expect(binaryArchitectures(elf)).toEqual(["aarch64"]);
    const pe = Buffer.alloc(128);
    pe.write("MZ");
    pe.writeUInt32LE(64, 60);
    pe.writeUInt32LE(0x4550, 64);
    pe.writeUInt16LE(0x8664, 68);
    expect(binaryArchitectures(pe)).toEqual(["x86_64"]);
    pe.writeUInt32LE(128, 60);
    expect(binaryArchitectures(pe)).toEqual([]);
  });
});
