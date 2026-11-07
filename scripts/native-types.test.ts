import { tmpdir } from "node:os";
import { test, assert } from "vitest";
import { join, resolve } from "node:path";
import { rmSync, mkdirSync, mkdtempSync, copyFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const repoRoot = resolve(import.meta.dirname, "..");
const nativeRoot = join(repoRoot, "packages/native");

function assertNoDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
  assert.strictEqual(
    diagnostics.length,
    0,
    ts.formatDiagnostics(diagnostics, {
      getCurrentDirectory: () => repoRoot,
      getCanonicalFileName: (file) => file,
      getNewLine: () => "\n"
    })
  );
}

test("Native 公开声明从全新编译产物导入时保留完整类型契约", () => {
  const temp = mkdtempSync(join(tmpdir(), "aira-native-types-"));
  try {
    const packageRoot = join(temp, "node_modules/@mahiru/native");
    mkdirSync(packageRoot, { recursive: true });
    copyFileSync(join(nativeRoot, "package.json"), join(packageRoot, "package.json"));

    const configPath = join(nativeRoot, "tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    assertNoDiagnostics(config.error ? [config.error] : []);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      nativeRoot,
      {
        rootDir: nativeRoot,
        outDir: join(packageRoot, "dist-types"),
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
        declarationMap: false
      },
      configPath
    );
    assertNoDiagnostics(parsed.errors);
    const native = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
    assertNoDiagnostics(ts.getPreEmitDiagnostics(native));
    const emitted = native.emit();
    assertNoDiagnostics(emitted.diagnostics);
    assert.strictEqual(emitted.emitSkipped, false);

    const consumer = join(temp, "consumer.ts");
    writeFileSync(
      consumer,
      `
      import { loadNativeAddon } from "@mahiru/native";
      import type {
        NativeAddon,
        MenuLyricEvent,
        MenuBarLyricWord,
        MenuLyricEventKind,
        MenuLyricEventHandler
      } from "@mahiru/native";

      type IsAny<T> = 0 extends (1 & T) ? true : false;
      declare const addonTypeIsAny: IsAny<NativeAddon>;
      declare const returnedTypeIsAny: IsAny<ReturnType<typeof loadNativeAddon>>;
      const addonTypeIsConcrete: false = addonTypeIsAny;
      const returnedTypeIsConcrete: false = returnedTypeIsAny;

      const addon: NativeAddon = loadNativeAddon("native.node");
      const word: MenuBarLyricWord = { startMs: 0, endMs: 500, text: "歌词" };
      const event: MenuLyricEvent = {
        kind: "click", x: 1, y: 2, width: 3, height: 4, displayId: 5
      };
      const kind: MenuLyricEventKind = event.kind;
      const onEvent: MenuLyricEventHandler = (error, received) => {
        const displayId: number = received.displayId;
        const message: string | undefined = error?.message;
      };
      addon.setCover(Buffer.alloc(0), null);
      addon.setCover(Buffer.alloc(0), new Uint8Array());
      addon.initMenuBar("icon.png", "AiraMusic");
      addon.setMenuBarWidth(240);
      addon.setMenuLyric("歌词", [word], onEvent);
      addon.setMenuLyricProgress(200, true);

      // @ts-expect-error NativeAddon 必须拒绝错误的宽度类型。
      addon.setMenuBarWidth("240");
      // @ts-expect-error 图片参数必须是字节或 null。
      addon.setCover(Buffer.alloc(0), "cover.png");
      // @ts-expect-error 逐字时间必须是数值。
      addon.setMenuLyric("歌词", [{ startMs: "0", endMs: 500, text: "歌词" }]);
      // @ts-expect-error 事件类型不能接受任意字符串。
      const invalidKind: MenuLyricEventKind = "middle-click";
      // @ts-expect-error 回调公开的是 MenuLyricEvent，不能退化为 any。
      const invalidDisplay: string = event.displayId;
    `
    );
    const isolatedConsumer = ts.createProgram({
      rootNames: [consumer],
      options: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ["lib.esnext.d.ts"],
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: ["node"],
        typeRoots: [join(repoRoot, "node_modules/@types")]
      }
    });
    assertNoDiagnostics(ts.getPreEmitDiagnostics(isolatedConsumer));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}, 20_000);
