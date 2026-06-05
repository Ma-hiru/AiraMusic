import { app, type Display, screen } from "electron";
import { MainRuntime } from "@/lib/runtime";
import { Log } from "@/lib/log";
import { MainWindowConstants } from "@/constants/window";
import type { ResolvedWindowSize, WindowSize, WindowSizePreset } from "@/types/window";

export class MainScreenResolver {
  private readonly display: Display;

  private constructor(display: Display) {
    this.display = display;
  }

  /**
   * 适配用的工作区尺寸 \
   * 直接用 Electron 上报的 workAreaSize \
   * BrowserWindow 的 width/height/x/y 与 workArea 处在同一套"当前后端坐标系"里 \
   * 只要窗口尺寸和 workArea 用同一套坐标就自洽
   */
  get effectiveWorkAreaSize() {
    return this.display.workAreaSize;
  }

  /**
   * idealFit 模式 \
   * 把 base 当理想尺寸
   * - 工作区放得下，直接用 base（大屏不放大）
   * - 放不下，等比收缩到工作区内（留 1-MAX_WINDOW_COVER_RATIO 边距），保持宽高比
   * 不使用 scaleFactor
   */
  private resolveIdealFit(base: WindowSize): WindowSize {
    const { width: workWidth, height: workHeight } = this.effectiveWorkAreaSize;
    const fitScale = Math.min(
      1,
      (workWidth * MainWindowConstants.MAX_WINDOW_COVER_RATIO) / base.width,
      (workHeight * MainWindowConstants.MAX_WINDOW_COVER_RATIO) / base.height
    );
    return {
      width: Math.round(base.width * fitScale),
      height: Math.round(base.height * fitScale)
    };
  }

  /**
   * 根据当前屏幕把窗口预设解析成实际尺寸（DIP） \
   * 返回 { base, min, max }：base 为初始尺寸，min/max 为 resize 边界
   */
  public adaptiveWindowSizePreset(preset: WindowSizePreset): ResolvedWindowSize {
    const { base } = preset;
    return {
      base: this.resolveIdealFit(base),
      min: preset.min ?? base,
      max: preset.max ?? base
    };
  }

  static get primary() {
    return new MainScreenResolver(screen.getPrimaryDisplay());
  }

  static getAllScreens() {
    return screen.getAllDisplays().map((display) => new MainScreenResolver(display));
  }

  static isOutScreenDIPBounds(x?: number, y?: number) {
    return !(
      typeof x === "number" &&
      typeof y === "number" &&
      screen
        .getAllDisplays()
        .some(
          ({ bounds }) =>
            x > bounds.x &&
            x < bounds.x + bounds.width &&
            y > bounds.y &&
            y < bounds.y + bounds.height
        )
    );
  }

  static printScreenInfo() {
    app.on("ready", () => {
      const displays = MainScreenResolver.getAllScreens();
      Log.debug(
        "app/dev.ts:printDevInfo",
        "\n",
        "===================== App Dev Info =====================\n",
        `Environment: ${MainRuntime.isDev ? "Development" : "Production"}\n`,
        `Platform: ${process.platform}\n`,
        `Electron Version: ${process.versions.electron}\n`,
        `Node.js Version: ${process.versions.node}\n`,
        `V8 Version: ${process.versions.v8}\n`,
        `Chrome Version: ${process.versions.chrome}\n`,
        `Screen Count: ${displays.length}\n`,
        `Displays:`,
        displays.map(String).join("\n"),
        "========================================================="
      );
    });
  }

  [Symbol.toPrimitive]() {
    return `
   Display of ${this.display.id}
     Info:
           Primary: ${screen.getPrimaryDisplay().id === this.display.id ? "Yes" : "No"}
           Internal: ${this.display.internal ? "Yes" : "No"}
           Position: (${this.display.bounds.x}, ${this.display.bounds.y})
           Rotation: ${this.display.rotation}°
           Scale Factor: ${this.display.scaleFactor}
           Size: ${this.display.size.width}@${this.display.size.height}
           Touch Support: ${this.display.touchSupport}
     Bounds:
           X:      ${this.display.bounds.x}
           Y:      ${this.display.bounds.y}
           Width:  ${this.display.bounds.width}
           Height: ${this.display.bounds.height}
     Logical Work Area:
           X:      ${this.display.workArea.x}
           Y:      ${this.display.workArea.y}
           Width:  ${this.display.workArea.width}
           Height: ${this.display.workArea.height}
     Logical Work Area Size:
           Width:  ${this.display.workAreaSize.width}
           Height: ${this.display.workAreaSize.height}
     Color Properties:
           Color Depth: ${this.display.colorDepth}
           Color Space: ${this.display.colorSpace}
  `;
  }
}
