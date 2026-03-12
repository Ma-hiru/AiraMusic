import Color from "color";

export default class UI {
  static readonly APPMainColorVarsName = "--theme-color-main";
  static readonly APPTextColorOnMainColorVarsName = "--text-color-on-main";
  static readonly APPSecondaryColorVarsName = "--theme-color-secondary";

  static get APPThemeColor() {
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

  static set APPThemeColor(colors) {
    const { main, secondary, textOnMainColor } = colors;
    document.documentElement.style.setProperty(this.APPMainColorVarsName, main);
    document.documentElement.style.setProperty(this.APPSecondaryColorVarsName, secondary);
    document.documentElement.style.setProperty(
      this.APPTextColorOnMainColorVarsName,
      textOnMainColor
    );
  }

  static get APPThemeColorDefault() {
    return {
      main: "#fc3d49",
      textOnMain: "#000000",
      secondary: "#ffffff"
    };
  }

  static get APPThemeColorInstance() {
    const { main, secondary, textOnMainColor } = this.APPThemeColor;
    return {
      main: Color(main),
      secondary: Color(secondary),
      textOnMainColor: Color(textOnMainColor)
    };
  }
}
