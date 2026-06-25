import Color, { type ColorInstance } from "color";
import { converter, formatHex } from "culori";
import { clamp } from "lodash-es";
import { Listener } from "@/common/utils/listenable";

export default class RendererTheme {
  static readonly BLACK_COLOR = Color("#000000");
  static readonly WHITE_COLOR = Color("#FFFFFF");
  static readonly themeCSSNameMain = "--theme-color-main";
  static readonly themeCSSNameSecondary = "--theme-color-secondary";
  static readonly themeCSSNameTextOnMain = "--text-color-on-main";
  static readonly themeCSSNameTextOnSecondary = "--text-color-on-secondary";
  static readonly themeCSSNameText = "--text-color";
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
    const { main, secondary, textOnMainColor, textColor, textOnSecondaryColor } = colors;
    document.documentElement.style.setProperty(this.themeCSSNameMain, main);
    document.documentElement.style.setProperty(this.themeCSSNameSecondary, secondary);
    document.documentElement.style.setProperty(this.themeCSSNameTextOnMain, textOnMainColor);
    document.documentElement.style.setProperty(
      this.themeCSSNameTextOnSecondary,
      textOnSecondaryColor
    );
    document.documentElement.style.setProperty(this.themeCSSNameText, textColor);
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
    const { main, secondary, textOnMainColor, textColor, textOnSecondaryColor } = this.theme;
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

  static smoothScrollTo(
    element: Optional<HTMLElement>,
    scrollTop: number,
    duration?: number
  ): Promise<void> {
    if (!element || !Number.isFinite(scrollTop)) return Promise.resolve();

    const elementExtended = element as HTMLElement & {
      raf?: number;
      resolve?: NormalFunc;
    };
    if (elementExtended.raf) cancelAnimationFrame(elementExtended.raf);
    if (elementExtended.resolve) elementExtended.resolve();

    if (scrollTop < 0) scrollTop = 0;
    const start = element.scrollTop;
    const distance = scrollTop - start;
    if (Math.abs(distance) < 1) {
      element.scrollTop = scrollTop;
      return Promise.resolve();
    }
    if (!duration) {
      duration = clamp(Math.abs(distance) * 8, 200, 800);
    }

    let startTime = -1;
    const { promise, resolve } = Promise.withResolvers<void>();
    const easeOutCubic = (t: number) => {
      return 1 - Math.pow(1 - t, 3);
    };
    const animate = (now: number) => {
      if (startTime < 0) startTime = now;
      const elapsed = now - startTime;
      const progress = clamp(elapsed / duration, 0, 1);
      const ease = easeOutCubic(progress);
      element.scrollTop = start + distance * ease;

      if (progress < 1) {
        elementExtended.raf = requestAnimationFrame(animate);
      } else {
        elementExtended.raf = 0;
        resolve();
      }
    };

    elementExtended.resolve = resolve;
    elementExtended.raf = requestAnimationFrame(animate);
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
