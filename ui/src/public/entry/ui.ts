import Color, { ColorInstance } from "color";
import { converter, formatHex } from "culori";
import { clamp } from "lodash-es";
import { Listener } from "@mahiru/ui/public/models/Listenable";

export default class AppUI {
  static readonly BLACK_COLOR = Color("#000000");
  static readonly WHITE_COLOR = Color("#FFFFFF");
  static readonly themeCSSNameMain = "--theme-color-main";
  static readonly themeCSSNameSecondary = "--theme-color-secondary";
  static readonly themeCSSNameTextOnMain = "--text-color-on-main";
  private static readonly listener = new Listener();
  private static readonly observer = new MutationObserver(
    this.listener.execute.bind(this.listener)
  );
  private static hasInitObserver = false;

  static addListener(cb: NormalFunc) {
    return this.listener.add(cb);
  }

  static removeListener(cb: NormalFunc) {
    return this.listener.remove(cb);
  }

  static initObserver() {
    if (this.hasInitObserver) return;
    this.hasInitObserver = true;
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"]
    });
  }

  static get theme() {
    this.initObserver();
    const styles = getComputedStyle(document.documentElement);

    const main = styles.getPropertyValue(this.themeCSSNameMain).trim() || this.themeDefault.main;
    const textOnMainColor =
      styles.getPropertyValue(this.themeCSSNameTextOnMain).trim() || this.themeDefault.textOnMain;
    const secondary =
      styles.getPropertyValue(this.themeCSSNameSecondary).trim() || this.themeDefault.secondary;

    return {
      main,
      secondary,
      textOnMainColor
    };
  }

  static set theme(colors) {
    const { main, secondary, textOnMainColor } = colors;
    document.documentElement.style.setProperty(this.themeCSSNameMain, main);
    document.documentElement.style.setProperty(this.themeCSSNameSecondary, secondary);
    document.documentElement.style.setProperty(this.themeCSSNameTextOnMain, textOnMainColor);
  }

  static get themeDefault() {
    return {
      main: "#fc3d49",
      textOnMain: "#000000",
      secondary: "#ffffff"
    };
  }

  static get themeInstance() {
    const { main, secondary, textOnMainColor } = this.theme;
    return {
      main: Color(main),
      secondary: Color(secondary),
      textOnMainColor: Color(textOnMainColor)
    };
  }

  static calcTextColor(bgColor: string | ColorInstance) {
    const bg = Color(bgColor);
    if (bg.isDark()) {
      return this.WHITE_COLOR;
    } else {
      return this.BLACK_COLOR;
    }
  }

  static smoothScrollTo(element: Optional<HTMLElement>, scrollTop: number, duration?: number) {
    if (!element || !Number.isFinite(scrollTop)) return;
    if (scrollTop < 0) scrollTop = 0;

    const elementExtended = element as HTMLElement & {
      raf?: number;
    };

    elementExtended.raf ||= 0;
    if (elementExtended.raf) {
      cancelAnimationFrame(elementExtended.raf);
      elementExtended.raf = 0;
    }

    const start = element.scrollTop;
    const distance = scrollTop - start;
    if (Math.abs(distance) < 1) {
      element.scrollTop = scrollTop;
      return;
    }

    if (!duration) {
      duration = clamp(Math.abs(distance) * 8, 200, 800);
    }

    let startTime = -1;
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
      }
    };

    elementExtended.raf = requestAnimationFrame(animate);
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
