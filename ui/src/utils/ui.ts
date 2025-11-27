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
