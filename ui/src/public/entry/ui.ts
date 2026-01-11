import Color from "color";

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
}

export class UIClass {
  readonly AMLyricColorVarsName = "--amll-lp-color";
  readonly AMLyricFontSizeVarsName = "--amll-lp-font-size";
  readonly APPMainColorVarsName = "--theme-color-main";
  readonly APPTextColorOnMainColorVarsName = "--text-color-on-main";
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
    const { main, secondary, textOnMainColor } = colors;
    document.documentElement.style.setProperty(this.APPMainColorVarsName, main);
    document.documentElement.style.setProperty(this.APPSecondaryColorVarsName, secondary);
    document.documentElement.style.setProperty(
      this.APPTextColorOnMainColorVarsName,
      textOnMainColor
    );
  }

  get APPThemeColorDefault() {
    return {
      main: "#fc3d49",
      textOnMain: "#000000",
      secondary: "#ffffff"
    };
  }

  get APPThemeColor() {
    const styles = getComputedStyle(document.documentElement);

    const main =
      styles.getPropertyValue(this.APPMainColorVarsName).trim() || this.APPThemeColorDefault.main;
    const textOnMainColor =
      styles.getPropertyValue(this.APPTextColorOnMainColorVarsName).trim() ||
      this.APPThemeColorDefault.textOnMain;
    const secondary =
      styles.getPropertyValue(this.APPSecondaryColorVarsName).trim() ||
      this.APPThemeColorDefault.secondary;

    return {
      main,
      secondary,
      textOnMainColor
    };
  }

  get APPThemeColorInstance() {
    const { main, secondary, textOnMainColor } = this.APPThemeColor;
    return {
      main: Color(main),
      secondary: Color(secondary),
      textOnMainColor: Color(textOnMainColor)
    };
  }

  readonly Utils = new UIUtilsClass();
}

export const UI = new UIClass();
