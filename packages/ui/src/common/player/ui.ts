import { clamp } from "lodash-es";
import { converter, formatHex } from "culori";
import { Listener } from "@/common/utils/listenable";
import Color, { type ColorInstance } from "color";

export default class RendererTheme {
  static readonly BLACK_COLOR = Color("#000000");
  static readonly WHITE_COLOR = Color("#FFFFFF");
  static readonly themeCSSNameMain = "--theme-color-main";
  static readonly themeCSSNameSecondary = "--theme-color-secondary";
  static readonly themeCSSNameTextOnMain = "--text-color-on-main";
  static readonly themeCSSNameTextOnSecondary = "--text-color-on-secondary";
  static readonly themeCSSNameText = "--text-color";
  static readonly themeCSSNamePrimaryHover = "--primary-hover";
  static readonly themeCSSNamePrimaryActive = "--primary-active";
  static readonly themeCSSNamePrimarySoft = "--primary-soft";
  private static readonly listener = new Listener();

  static addListener(cb: NormalFunc) {
    return this.listener.add(cb);
  }

  static removeListener(cb: NormalFunc) {
    return this.listener.remove(cb);
  }

  static get theme() {
    const styles = getComputedStyle(document.documentElement);

    const main = styles.getPropertyValue(this.themeCSSNameMain).trim() || this.themeDefault.main;
    const textOnMainColor =
      styles.getPropertyValue(this.themeCSSNameTextOnMain).trim() || this.themeDefault.textOnMain;
    const textOnSecondaryColor =
      styles.getPropertyValue(this.themeCSSNameTextOnSecondary).trim() ||
      this.themeDefault.textOnSecondary;
    const secondary =
      styles.getPropertyValue(this.themeCSSNameSecondary).trim() || this.themeDefault.secondary;
    const textColor =
      styles.getPropertyValue(this.themeCSSNameText).trim() || this.themeDefault.text;

    return {
      main,
      secondary,
      textOnMainColor,
      textOnSecondaryColor,
      textColor
    };
  }

  static set theme(colors) {
    const { main, secondary, textColor, textOnMainColor, textOnSecondaryColor } = colors;
    document.documentElement.style.setProperty(this.themeCSSNameMain, main);
    document.documentElement.style.setProperty(this.themeCSSNameSecondary, secondary);
    document.documentElement.style.setProperty(this.themeCSSNameTextOnMain, textOnMainColor);
    document.documentElement.style.setProperty(
      this.themeCSSNameTextOnSecondary,
      textOnSecondaryColor
    );
    document.documentElement.style.setProperty(this.themeCSSNameText, textColor);
  }

  /**
   * 用 generatePalette 把主色铺成受控的「主色阶梯」，写入 CSS 变量供 @theme 语义 token 使用：
   * --primary-hover（palette 400，hover）、--primary-active（600，按下）、
   * --primary-soft（400 低透明，中性表面上的淡底；注意彩色背景上几乎不可见）。
   * 主色本身已是 --theme-color-main，这里只补受控的 hover/active/soft 三档。
   */
  static setPrimaryScale(main: string) {
    const p = this.generatePalette(main);
    const root = document.documentElement.style;
    root.setProperty(this.themeCSSNamePrimaryHover, p[400].hex());
    root.setProperty(this.themeCSSNamePrimaryActive, p[600].hex());
    root.setProperty(this.themeCSSNamePrimarySoft, p[400].alpha(0.18).string());
  }

  static get themeDefault() {
    return {
      main: "#ff3b5c",
      textOnMain: "#000000",
      secondary: "#ff6b81",
      text: "#000000",
      textOnSecondary: "#000000"
    };
  }

  static get themeInstance() {
    const { main, secondary, textColor, textOnMainColor, textOnSecondaryColor } = this.theme;
    return {
      main: Color(main),
      secondary: Color(secondary),
      textOnMainColor: Color(textOnMainColor),
      textColor: Color(textColor),
      textOnSecondaryColor: Color(textOnSecondaryColor)
    };
  }

  /** WCAG 相对对比度 (L1+0.05)/(L2+0.05)，luminosity() 由 color 库提供 */
  static contrastRatio(a: ColorInstance, b: ColorInstance) {
    // 计算WCAG相对亮度（sRGB 线性化后的值） L = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const la = a.luminosity();
    const lb = b.luminosity();
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  static calcTextColor(bgColor: string | ColorInstance) {
    const bg = Color(bgColor);
    const whiteContrast = this.contrastRatio(bg, this.WHITE_COLOR);
    // WCAG 推荐对比度 4.5:1
    if (whiteContrast >= 4) return this.WHITE_COLOR;
    const blackContrast = this.contrastRatio(bg, this.BLACK_COLOR);
    return blackContrast > whiteContrast ? this.BLACK_COLOR : this.WHITE_COLOR;
  }

  /** 一组颜色的平均 WCAG 相对亮度 (0..1)，用作背景明暗估计。空数组返回 0 */
  static avgLuminance(colors: readonly string[]) {
    if (!colors.length) return 0;
    let sum = 0;
    for (const c of colors) {
      try {
        sum += Color(c).luminosity();
      } catch {
        /* 跳过非法色值 */
      }
    }
    return sum / colors.length;
  }

  /**
   * 为背景双色渐变挑两端颜色
   * 1) 一端固定取主色（colors[0]）；
   * 2) 另一端取调色板里有彩度且色相离主色最远的颜色；
   * 3) 若最远的也不够远（封面本就单色），在 OKLCH 里把主色旋转 manufacturedSpread 度，人造一个相邻色相，保证渐变肉眼可见
   */
  static pickGradientColors(
    colors: readonly string[],
    minSpread = 30, // 次色和主色的色相至少要差的度
    manufacturedSpread = 35 // 单色封面时人造第二色的旋转角（度）
  ): [string, string] {
    // oklch
    // h => hue       色相
    // c => chroma    彩度
    // l => lightness 感知亮度
    const oklch = converter("oklch");

    const a = oklch(colors[0] ?? this.themeDefault.main) ?? oklch(this.themeDefault.main)!;
    const aH = a.h ?? 0; // 灰色没有明确 hue, 这里偏向红色系

    const circDist = (h1: number, h2: number) => {
      const d = Math.abs(h1 - h2) % 360;
      return d > 180 ? 360 - d : d;
    };

    let bestHex: Undefinable<string>;
    let bestD = -1;
    for (let i = 1; i < colors.length; i++) {
      const cs = colors[i];
      if (!cs) continue;

      const c = oklch(cs);
      if (!c || (c.c ?? 0) < 0.03 || c.h == null) continue; // 跳过近灰

      const d = circDist(aH, c.h);
      if (d > bestD) {
        bestD = d;
        bestHex = cs;
      }
    }

    const aHex = formatHex(a);
    if (bestHex && bestD >= minSpread) return [aHex, bestHex];

    // 单色封面：旋转主色相人造第二端，亮度/彩度也错开一点更像渐变
    const manufactured = formatHex({
      mode: "oklch",
      // 主色偏亮/暗，就让第二色稍微暗/亮一点
      l: clamp(a.l + (a.l > 0.5 ? -0.08 : 0.08), 0, 1),
      // 第二色的彩度至少为 0.1
      c: Math.max(a.c ?? 0, 0.1),
      // 所以第二色的 hue 是主色偏移 (aH + manufacturedSpread) % 360
      h: (aH + manufacturedSpread) % 360
    });

    return [aHex, manufactured];
  }

  /**
   * 每个 HTMLElement 当前正在执行的滚动任务
   *
   * WeakMap 不会阻止 HTMLElement 被 GC
   */
  private static readonly smoothScrollTasks = new WeakMap<HTMLElement, SmoothScrollTask>();

  /**
   * 平滑滚动到指定位置
   *
   * 语义：
   *
   * 1. 同一个 element 同时只能存在一个滚动任务
   * 2. 新任务会取消旧任务（latest-wins）
   * 3. 被新任务替代时，旧任务返回：
   *    { status: "cancelled", reason: "superseded" }
   * 4. 正常完成时，会在设置最终 scrollTop 后，
   *    再等待一次 requestAnimationFrame，
   *    给浏览器一次实际渲染最终状态的机会
   */
  static smoothScrollTo(
    element: Optional<HTMLElement>,
    scrollTop: number,
    duration?: number
  ): Promise<SmoothScrollResult> {
    if (!element || !Number.isFinite(scrollTop)) {
      return Promise.resolve({ status: "cancelled", reason: "superseded" });
    }
    // 取消该 element 上一个滚动任务
    const previous = this.smoothScrollTasks.get(element);
    if (previous) {
      cancelAnimationFrame(previous.raf);
      previous.resolve({
        status: "cancelled",
        reason: "superseded"
      });
      this.smoothScrollTasks.delete(element);
    }
    // 浏览器真正允许的 scrollTop 范围
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const target = clamp(scrollTop, 0, maxScrollTop);
    const start = element.scrollTop;
    const distance = target - start;
    const actualDuration = duration ?? clamp(Math.abs(distance) * 8, 200, 800);

    const { promise, resolve } = Promise.withResolvers<SmoothScrollResult>();
    const task: SmoothScrollTask = { raf: 0, resolve };
    this.smoothScrollTasks.set(element, task);

    const finish = () => {
      element.scrollTop = target;
      task.raf = requestAnimationFrame(() => {
        // 等待最终 frame 的过程中，可能又有一个新的滚动任务进来了, resolve 被新任务处理
        if (this.smoothScrollTasks.get(element) !== task) return;
        this.smoothScrollTasks.delete(element);
        resolve({ status: "finished" });
      });
    };

    // 已经基本处于目标位置，或调用者明确要求 duration = 0
    if (Math.abs(distance) < 1 || actualDuration <= 0) {
      finish();
      return promise;
    }

    let startTime: number;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const animate = (now: number) => {
      if (this.smoothScrollTasks.get(element) !== task) return;
      startTime ??= now;
      const elapsed = now - startTime;
      const progress = clamp(elapsed / actualDuration, 0, 1);
      const eased = easeOutCubic(progress);
      element.scrollTop = start + distance * eased;
      if (progress >= 1) return finish();
      task.raf = requestAnimationFrame(animate);
    };
    task.raf = requestAnimationFrame(animate);

    return promise;
  }

  static generatePalette(color: string) {
    const base = converter("oklch")(color);
    return <Record<LIGHTNESS_SCALE, ColorInstance>>Object.fromEntries(
      Object.entries(Palette_SCALE).map(([key, l]) => {
        return [
          key,
          Color(
            formatHex({
              mode: "oklch",
              l,
              c: base!.c * (l > base!.l ? 0.6 : 0.9),
              h: base!.h
            })
          )
        ];
      })
    );
  }

  static {
    const observer = new MutationObserver(() => this.listener.execute());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"]
    });
  }
}

export type LIGHTNESS_SCALE = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

const Palette_SCALE: Record<LIGHTNESS_SCALE, number> = {
  50: 0.98,
  100: 0.95,
  200: 0.9,
  300: 0.82,
  400: 0.72,
  500: 0.62,
  600: 0.52,
  700: 0.42,
  800: 0.32,
  900: 0.22
};

export type SmoothScrollResult =
  | {
      status: "finished";
    }
  | {
      status: "cancelled";
      reason: "superseded";
    };

interface SmoothScrollTask {
  raf: number;
  resolve: (result: SmoothScrollResult) => void;
}
