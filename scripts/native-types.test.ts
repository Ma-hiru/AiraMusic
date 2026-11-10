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
        TaskbarAction,
        MenuLyricEvent,
        MenuBarLyricWord,
        DarwinNativeAddon,
        MenuLyricEventKind,
        WindowsNativeAddon,
        TaskbarButtonIcons,
        TaskbarActionHandler,
        MenuLyricEventHandler
      } from "@mahiru/native";

      type IsAny<T> = 0 extends (1 & T) ? true : false;
      declare const addonTypeIsAny: IsAny<NativeAddon>;
      declare const returnedTypeIsAny: IsAny<ReturnType<typeof loadNativeAddon>>;
      declare const windowsTypeIsAny: IsAny<WindowsNativeAddon>;
      declare const darwinTypeIsAny: IsAny<DarwinNativeAddon>;
      const addonTypeIsConcrete: false = addonTypeIsAny;
      const returnedTypeIsConcrete: false = returnedTypeIsAny;
      const windowsTypeIsConcrete: false = windowsTypeIsAny;
      const darwinTypeIsConcrete: false = darwinTypeIsAny;

      const addon: NativeAddon = loadNativeAddon("native.node");
      const word: MenuBarLyricWord = { startMs: 0, endMs: 500, text: "歌词" };
      const event: MenuLyricEvent = {
        kind: "click", x: 1, y: 2, width: 3, height: 4, displayId: 5
      };
      const kind: MenuLyricEventKind = event.kind;
      const onEvent: MenuLyricEventHandler = (error, received) => {
        const displayId: number = received.displayId;
        const message: string | undefined = error?.message;
        // @ts-expect-error 回调事件的 displayId 不能退化为 any。
        const invalidDisplay: string = received.displayId;
      };
      const icons: TaskbarButtonIcons = {
        next: new Uint8Array(), play: new Uint8Array(),
        pause: new Uint8Array(), previous: new Uint8Array()
      };
      const onAction: TaskbarActionHandler = (error, action) => {
        const received: TaskbarAction = action;
        const message: string | undefined = error?.message;
        // @ts-expect-error 回调动作不能退化为 any。
        const invalidAction: "stop" = action;
      };

      // 载入结果是平台联合类型，收窄前不能使用平台专属方法。
      // @ts-expect-error 尚未确认是 Windows 产物。
      addon.setCover(Buffer.alloc(0), null);
      // @ts-expect-error 尚未确认是 macOS 产物。
      addon.initMenuBar("icon.png", "AiraMusic");

      if ("setCover" in addon) {
        const windows: WindowsNativeAddon = addon;
        addon.setCover(Buffer.alloc(0), null);
        addon.setCover(Buffer.alloc(0), new Uint8Array());
        addon.setTaskbarButtons(Buffer.alloc(0), true, icons, onAction);
        // @ts-expect-error 图片参数必须是字节或 null。
        addon.setCover(Buffer.alloc(0), "cover.png");
        // @ts-expect-error 播放状态必须是 boolean。
        addon.setTaskbarButtons(Buffer.alloc(0), "true", icons, onAction);
        // @ts-expect-error 按钮图标必须是字节。
        addon.setTaskbarButtons(Buffer.alloc(0), true, { ...icons, play: "play.png" }, onAction);
        // @ts-expect-error Windows 产物没有菜单栏歌词接口。
        addon.initMenuBar("icon.png", "AiraMusic");
      } else {
        const darwin: DarwinNativeAddon = addon;
        addon.initMenuBar("icon.png", "AiraMusic");
        addon.setMenuBarToolTip("AiraMusic");
        addon.setMenuBarWidth(240);
        addon.setMenuBarVisible(true);
        addon.setMenuLyric("歌词", [word], onEvent);
        addon.setMenuLyric("歌词", []);
        addon.setMenuLyricProgress(200, true);
        // @ts-expect-error 宽度必须是数值。
        addon.setMenuBarWidth("240");
        // @ts-expect-error 逐字时间必须是数值。
        addon.setMenuLyric("歌词", [{ startMs: "0", endMs: 500, text: "歌词" }]);
        // @ts-expect-error macOS 产物没有任务栏封面接口。
        addon.setCover(Buffer.alloc(0), null);
      }

      // @ts-expect-error 任务栏动作不能接受任意字符串。
      const invalidAction: TaskbarAction = "stop";
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
