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

  static readonly WINDOW_BASE_SIZE = {
    login: {
      width: 560,
      height: 330
    },
    image: {
      width: 1024,
      height: 600
    },
    lyric: {
      width: 720,
      height: 120
    },
    miniplayer: {
      default: {
        width: 330,
        height: 75
      },
      min: {
        width: 240,
        height: 54
      },
      max: {
        width: 396,
        height: 90
      }
    },
    trayOnWindows: {
      width: 180,
      height: 450
    },
    info: {
      width: 1024,
      height: 600
    },
    external: {
      width: 1024,
      height: 600
    }
  } as const;
}
