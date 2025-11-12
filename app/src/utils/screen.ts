import { screen } from "electron";

export const DefaultWidthHeightRatio = 16 / 9;
export const DefaultCoverRatio = 0.8;

export function getEffectiveWindowSize(
  widthHeightRatio: number = DefaultWidthHeightRatio,
  coverRatio: number = DefaultCoverRatio
) {
  const { effectiveScreenWidth, effectiveScreenHeight } = getEffectiveWorkAreaSize();
  const targetHeight = Math.floor(effectiveScreenHeight * coverRatio);
  const targetWidth = Math.floor(targetHeight * widthHeightRatio);

  if (targetWidth < effectiveScreenWidth) {
    return {
      width: targetWidth,
      height: targetHeight
    };
  } else {
    const adjustedWidth = Math.floor(effectiveScreenWidth * coverRatio);
    const adjustedHeight = Math.floor(adjustedWidth / widthHeightRatio);
    return {
      width: adjustedWidth,
      height: adjustedHeight
    };
  }
}

export function getEffectiveWorkAreaSize() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
  const effectiveScreenWidth = Math.floor(screenWidth / scaleFactor);
  const effectiveScreenHeight = Math.floor(screenHeight / scaleFactor);
  return { effectiveScreenWidth, effectiveScreenHeight };
}
