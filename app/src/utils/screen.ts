import { screen } from "electron";
import { isLinux } from "./platform";
import { AppWindowConstants } from "../constant/win";

const { DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO, DEFAULT_WINDOW_COVER_RATIO } = AppWindowConstants;

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
  if (isLinux) {
    const sf = screen.getPrimaryDisplay().scaleFactor;
    return {
      effectiveScreenWidth: Math.floor(width / sf),
      effectiveScreenHeight: Math.floor(height / sf)
    };
  }
  return {
    effectiveScreenWidth: width,
    effectiveScreenHeight: height
  };
}

export function checkPositionOutScreenBounds(x?: number, y?: number) {
  return !(
    typeof x === "number" &&
    typeof y === "number" &&
    screen
      .getAllDisplays()
      .some(
        ({ bounds }) =>
          x > bounds.x &&
          x < bounds.x + bounds.width &&
          y > bounds.y &&
          y < bounds.y + bounds.height
      )
  );
}

export function getScreenInfo() {
  return screen.getAllDisplays();
}
