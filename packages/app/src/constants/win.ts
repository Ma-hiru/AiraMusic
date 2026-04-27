export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowSizePresetBase {
  base: WindowSize;
}

export interface WindowSizePreset extends WindowSizePresetBase {
  min: WindowSize;
  max: WindowSize;
}

export class AppWindowConstants {
  static readonly MAIN_WINDOW_TITLE = `${process.env.APP_NAME} - ${process.env.APP_DESC}`;
  static readonly REFERENCE_WORK_AREA_SIZE = {
    width: 1920,
    height: 1040
  };
  static readonly WINDOW_BASE_SIZE = {
    main: {
      base: {
        width: 1080,
        height: 650
      },
      min: {
        width: 864,
        height: 507
      }
    },
    login: {
      base: {
        width: 560,
        height: 330
      }
    },
    image: {
      base: {
        width: 1024,
        height: 600
      }
    },
    lyric: {
      base: {
        width: 720,
        height: 120
      }
    },
    miniplayer: {
      base: {
        width: 250,
        height: 55
      },
      min: {
        width: 240,
        height: 55
      },
      max: {
        width: 280,
        height: 55
      }
    },
    trayOnWindows: {
      base: {
        width: 180,
        height: 450
      }
    },
    info: {
      base: {
        width: 1024,
        height: 600
      }
    },
    comments: {
      base: {
        width: 750,
        height: 2048
      }
    },
    external: {
      base: {
        width: 1024,
        height: 600
      }
    }
  } satisfies Record<string, WindowSizePreset | WindowSizePresetBase>;
}
