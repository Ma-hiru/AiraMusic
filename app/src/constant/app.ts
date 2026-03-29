import { WindowID } from "../window";

export const MAIN_WINDOW_TITLE = process.env.APP_NAME;
export const MAIN_WINDOW_ID: WindowID = "main";
/** 16:9 */
export const DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO = 1.7;
/** 80% of the screen */
export const DEFAULT_WINDOW_COVER_RATIO = 0.8;
export const DEFAULT_WINDOW_SIZE = {
  width: 1330,
  height: 780
};
