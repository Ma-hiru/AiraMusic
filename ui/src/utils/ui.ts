import Color from "color";

class _Utils {
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
}

class _UI {
  readonly AMLyricColorVarsName = "--amll-lp-color";
  readonly AMLyricFontSizeVarsName = "--amll-lp-font-size";
  readonly APPMainColorVarsName = "--theme-color-main";
  readonly APPSecondaryColorVarsName = "--theme-color-secondary";

  set AMLyricColor(color: string) {
    if (color) {
      document.documentElement.style.setProperty(this.AMLyricColorVarsName, color);
    } else {
      document.documentElement.style.removeProperty(this.AMLyricColorVarsName);
    }
  }

  set AMLyricFontSize(size: string) {
    if (size) {
      document.documentElement.style.setProperty(this.AMLyricFontSizeVarsName, size);
    } else {
      document.documentElement.style.removeProperty(this.AMLyricFontSizeVarsName);
    }
  }

  set APPThemeColor(colors) {
    const { main, secondary } = colors;
    document.documentElement.style.setProperty(this.APPMainColorVarsName, main);
    document.documentElement.style.setProperty(this.APPSecondaryColorVarsName, secondary);
  }

  get APPThemeColor() {
    const mainVarsName = "--theme-color-main";
    const secondaryVarsName = "--theme-color-secondary";
    const styles = getComputedStyle(document.documentElement);
    const main = styles.getPropertyValue(mainVarsName).trim() || "#fc3d49";
    const secondary = styles.getPropertyValue(secondaryVarsName).trim() || "#ffffff";
    return {
      main,
      secondary
    };
  }

  get APPThemeColorInstance() {
    const { main, secondary } = this.APPThemeColor;
    return {
      main: Color(main),
      secondary: Color(secondary)
    };
  }

  readonly Utils = new _Utils();
}

export const UI = new _UI();
