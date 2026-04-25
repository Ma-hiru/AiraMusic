import { app, Display, screen } from "electron";
import { Log } from "./log";
import { isDev } from "./dev";
import { clamp } from "lodash-es";
import {
  AppWindowConstants,
  WindowSize,
  WindowSizePreset,
  WindowSizePresetBase
} from "../constants/win";

type AdaptiveWindowSizePresetReturn<
  T extends WindowSizePreset | WindowSizePresetBase | Omit<WindowSizePreset, "max">
> = T extends WindowSizePreset | Omit<WindowSizePreset, "max"> ? T : WindowSize;

export default class AppScreen {
  private display: Display;

  private constructor(display: Display) {
    this.display = display;
  }

  get logicalScreenSize() {
    return this.display.size;
  }

  get logicalWorkAreaSize() {
    return this.display.workAreaSize;
  }

  get scaleFactor() {
    return this.display.scaleFactor;
  }

  get physicalScreenSize() {
    const { width, height } = this.display.size;
    const sf = this.display.scaleFactor;
    return {
      width: Math.floor(width * sf),
      height: Math.floor(height * sf)
    };
  }

  get physicalWorkAreaSize() {
    const { width, height } = this.display.workAreaSize;
    const sf = this.display.scaleFactor;
    return {
      width: Math.floor(width * sf),
      height: Math.floor(height * sf)
    };
  }

  get adaptiveSafeRatio() {
    const { width, height } = this.logicalWorkAreaSize;
    const sf = this.scaleFactor;
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);

    // 默认比例
    let ratio = 0.7;
    // 小屏幕：降低占用比例，避免贴边
    if (shortSide <= 720) {
      ratio -= 0.08; // 0.80
    } else if (shortSide <= 900) {
      ratio -= 0.04; // 0.84
    }
    // 带鱼屏：按高度体验走，不能因为宽度大就占太满
    if (longSide / shortSide >= 2.1) {
      ratio -= 0.04;
    }
    // 高 DPI 屏幕通常显示更细腻，不需要窗口占比过高。
    if (sf >= 2) {
      ratio -= 0.03;
    } else if (sf >= 1.5) {
      ratio -= 0.015;
    }

    return ratio;
  }

  get adaptiveBaseSafeRatio() {
    const { width, height } = this.logicalWorkAreaSize;
    const sf = this.scaleFactor;

    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const aspectRatio = longSide / shortSide;

    let ratio = 0.7;
    // 小屏幕：降低占用比例，避免贴边
    if (shortSide <= 720) {
      ratio -= 0.08;
    } else if (shortSide <= 900) {
      ratio -= 0.04;
    }
    // 带鱼屏不能因为宽度大就把窗口撑大
    if (aspectRatio >= 2.1) {
      ratio -= 0.04;
    }
    // 高 DPI 屏幕通常显示更细腻，不需要窗口占比过高。
    if (sf >= 2) {
      ratio -= 0.03;
    } else if (sf >= 1.5) {
      ratio -= 0.015;
    }

    return clamp(ratio, 0.56, 0.72);
  }

  get adaptiveResizeSafeRatio() {
    /**
     * resize 上限应该比 base 舒适区更大。
     * 否则 max 会把整个 preset 压得太小。
     */
    return clamp(this.adaptiveBaseSafeRatio + 0.18, 0.76, 0.9);
  }

  get visualScreenScale() {
    const { width, height } = this.logicalWorkAreaSize;
    const ref = AppWindowConstants.REFERENCE_WORK_AREA_SIZE;
    const rawScale = Math.min(width / ref.width, height / ref.height);

    /**
     * 小屏幕：正常缩小
     * 大屏幕：只温和放大，不线性暴涨
     */
    if (rawScale <= 1) {
      return rawScale;
    }

    /**
     * 大屏幕只温和放大。
     *
     * rawScale = 1.00 -> 1.00
     * rawScale = 1.33 -> 约 1.07
     * rawScale = 2.00 -> 约 1.18
     */
    return 1 + Math.log2(rawScale) * 0.18;
  }

  private scaleSize(size: WindowSize, scale: number): WindowSize {
    return {
      width: Math.floor(size.width * scale),
      height: Math.floor(size.height * scale)
    };
  }

  private scalePreset(preset: WindowSizePreset, scale: number): WindowSizePreset {
    return {
      min: this.scaleSize(preset.min, scale),
      base: this.scaleSize(preset.base, scale),
      max: this.scaleSize(preset.max, scale)
    };
  }

  public adaptiveWindowSizePreset<
    T extends WindowSizePreset | WindowSizePresetBase | Omit<WindowSizePreset, "max">
  >(preset: T): AdaptiveWindowSizePresetReturn<T> {
    const { width: sw, height: sh } = this.logicalWorkAreaSize;

    const baseSafeRatio = this.adaptiveBaseSafeRatio;
    const baseSafeSize = {
      width: sw * baseSafeRatio,
      height: sh * baseSafeRatio
    };

    /**
     * 1. baseFitScale：
     * 保证默认 base 不会太贴边。
     */
    const baseFitScale = Math.min(
      baseSafeSize.width / preset.base.width,
      baseSafeSize.height / preset.base.height
    );

    /**
     * 2. visualScreenScale：
     * 控制不同屏幕下整体视觉缩放。
     */
    let scale = Math.min(this.visualScreenScale, baseFitScale);

    /**
     * 3. 如果有 max，则额外保证 max 不会超过 resize 安全区。
     */
    if ("max" in preset) {
      const resizeSafeRatio = this.adaptiveResizeSafeRatio;
      const resizeSafeSize = {
        width: sw * resizeSafeRatio,
        height: sh * resizeSafeRatio
      };
      const maxFitScale = Math.min(
        resizeSafeSize.width / preset.max.width,
        resizeSafeSize.height / preset.max.height
      );
      scale = Math.min(scale, maxFitScale);
      return {
        min: this.scaleSize(preset.min, scale),
        base: this.scaleSize(preset.base, scale),
        max: this.scaleSize(preset.max, scale)
      } as AdaptiveWindowSizePresetReturn<T>;
    }

    /**
     * 4. 没有 min/max 的窗口：
     * 只返回 base + scale，不限制 resize。
     */
    if ("min" in preset) {
      return {
        min: preset.min,
        base: this.scaleSize(preset.base, scale)
      } as AdaptiveWindowSizePresetReturn<T>;
    }

    return this.scaleSize(preset.base, scale) as AdaptiveWindowSizePresetReturn<T>;
  }

  static get primary() {
    return new AppScreen(screen.getPrimaryDisplay());
  }

  static getAllScreens() {
    return screen.getAllDisplays().map((display) => new AppScreen(display));
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
      const displays = AppScreen.getAllScreens();
      Log.debug(
        "app/dev.ts:printDevInfo",
        "\n",
        "===================== App Dev Info =====================\n",
        `Environment: ${isDev ? "Development" : "Production"}\n`,
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
