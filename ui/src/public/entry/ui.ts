import Color from "color";

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
}

export const UI = new UIClass();
