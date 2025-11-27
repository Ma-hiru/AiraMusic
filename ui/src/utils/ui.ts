export function changeLyricComponentColorByCSSVar(color?: string) {
  const varsName = "--amll-lp-color";
  if (color) {
    document.documentElement.style.setProperty(varsName, color);
  } else {
    document.documentElement.style.removeProperty(varsName);
  }
}
