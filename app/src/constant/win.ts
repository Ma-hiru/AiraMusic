export class AppWindowConstants {
  /** 16:9 */
  static readonly DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO = 1.7;
  /** 80% of the screen */
  static readonly DEFAULT_WINDOW_COVER_RATIO = 0.8;
  static readonly MAIN_WINDOW_TITLE = `${process.env.APP_NAME} - ${process.env.APP_DESC}`;
  static readonly DEFAULT_MAIN_WINDOW_BOUNDS = {
    maxWidth: 1330,
    maxHeight: 780,
    minWidth: 864,
    minHeight: 507
  };
}
