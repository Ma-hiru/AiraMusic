import Color from "color";
import { clamp } from "lodash-es";

export class UIUtilsClass {
  readonly BLACK = Color("#000000");
  readonly WHITE = Color("#FFFFFF");

  calcTextColorOn(bgColor: string) {
    const bg = Color(bgColor);
    if (bg.isDark()) {
      return this.WHITE;
    } else {
      return this.BLACK;
    }
  }

  darkenOrLightenTextColorOn(bgColor: string, textColor: string, ratio: number = 0.3) {
    const bg = Color(bgColor);
    const text = Color(textColor);
    if (bg.isDark()) {
      return text.lighten(ratio);
    } else {
      return text.darken(ratio);
    }
  }

  smoothScrollTo(element: Optional<HTMLElement>, scrollTop: number, duration?: number) {
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
}

export const UIUtils = new UIUtilsClass();
