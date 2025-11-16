import { screen } from "electron";
import { CONSTANTS } from "../constant";

const { DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO, DEFAULT_WINDOW_COVER_RATIO } = CONSTANTS.APP;

export function getEffectiveWindowSize(
  coverRatio: number = DEFAULT_WINDOW_COVER_RATIO,
  widthHeightRatio: number = DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO
) {
  const { effectiveScreenWidth, effectiveScreenHeight } = getEffectiveWorkAreaSize();
  const targetHeight = Math.floor(effectiveScreenHeight * coverRatio);
  const targetWidth = Math.floor(targetHeight * widthHeightRatio);

  if (targetWidth < effectiveScreenWidth) {
    return {
      effectiveWidth: targetWidth,
      effectiveHeight: targetHeight
    };
  } else {
    const adjustedWidth = Math.floor(effectiveScreenWidth * coverRatio);
    const adjustedHeight = Math.floor(adjustedWidth / widthHeightRatio);
    return {
      effectiveWidth: adjustedWidth,
      effectiveHeight: adjustedHeight
    };
  }
}

export function getEffectiveWorkAreaSize() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    effectiveScreenWidth: width,
    effectiveScreenHeight: height
  };
}

export function calcEffectivePixel(pixel: number) {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
  return Math.floor(pixel / scaleFactor);
}
