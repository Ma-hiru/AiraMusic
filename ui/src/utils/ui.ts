import Color from "color";

export function changeLyricComponentColorByCSSVar(color?: string) {
  const varsName = "--amll-lp-color";
  if (color) {
    document.documentElement.style.setProperty(varsName, color);
  } else {
    document.documentElement.style.removeProperty(varsName);
  }
}

export function changeLyricComponentFontSizeByCSSVar(size?: string) {
  const varsName = "--amll-lp-font-size";
  if (size) {
    document.documentElement.style.setProperty(varsName, size);
  } else {
    document.documentElement.style.removeProperty(varsName);
  }
}

export function changeThemeColorByCSSVar(main: string, secondary: string) {
  const mainVarsName = "--theme-color-main";
  const secondaryVarsName = "--theme-color-secondary";
  document.documentElement.style.setProperty(mainVarsName, main);
  document.documentElement.style.setProperty(secondaryVarsName, secondary);
}

export function readThemeColorByCSSVar() {
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

const black = Color("#000000");
const white = Color("#FFFFFF");

export function getTextColorByBackgroundColor(bgColor: string) {
  const bg = Color(bgColor);
  if (bg.isDark()) {
    return white;
  } else {
    return black;
  }
}

export function darkenOrLightenTextColorWithBackgroundColor(
  bgColor: string,
  textColor: string,
  ratio: number = 0.3
) {
  const bg = Color(bgColor);
  const text = Color(textColor);
  if (bg.isDark()) {
    return text.lighten(ratio);
  } else {
    return text.darken(ratio);
  }
}
