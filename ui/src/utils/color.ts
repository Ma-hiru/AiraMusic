export function isDark(
  img: ArrayBuffer,
  postion: {
    x1: `${number}%`;
    y1: `${number}%`;
    x2: `${number}%`;
    y2: `${number}%`;
  }
) {}

export function changeLyricComponentColorByCSSVar(color?: string) {
  const varsName = "--amll-lp-color";
  if (color) {
    document.documentElement.style.setProperty(varsName, color);
  } else {
    document.documentElement.style.removeProperty(varsName);
  }
}
