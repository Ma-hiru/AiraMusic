import type { WindowSizePreset } from "@/types/window";

export class MainWindowConstants {
  static readonly MAX_WINDOW_COVER_RATIO = 0.95;
  static readonly MAIN_WINDOW_TITLE = `${process.env.APP_NAME} - ${process.env.APP_DESC}`;
  static readonly TRAY_HIDDEN_POINT = { x: -32000, y: -32000 } as const;
  /**
   * 所有尺寸均为 DIP（逻辑像素），不涉及 scaleFactor / DPR。
   * 统一策略 idealFit（参考 VS Code）：base 是理想尺寸，大屏不放大、小屏才等比收缩；
   * base 同时定义窗口宽高比；min/max 仅作用户拖拽 resize 的边界。
   * 详见 .agent/screen-adaptation.md。
   */
  static readonly WINDOW_BASE_SIZE = {
    // 主窗口
    main: {
      base: { width: 1080, height: 650 },
      min: { width: 896, height: 539 }
    },
    // 登录：小对话框（resizable: false）
    login: {
      base: { width: 560, height: 330 }
    },
    // 图片查看器
    image: {
      base: { width: 1024, height: 600 },
      min: { width: 800, height: 469 }
    },
    // 桌面歌词条，宽高比 6:1
    lyric: {
      base: { width: 720, height: 120 },
      min: { width: 480, height: 80 },
      max: { width: 1100, height: 183 }
    },
    // 迷你播放器：定高变宽，min/max 为 resize 边界
    miniplayer: {
      base: { width: 260, height: 68 },
      min: { width: 240, height: 68 },
      max: { width: 300, height: 68 }
    },
    radio: {
      min: { width: 600, height: 280 },
      base: { width: 620, height: 300 },
      max: { width: 640, height: 320 }
    },
    // Windows 托盘弹窗
    trayOnWindows: {
      base: { width: 180, height: 450 }
    },
    // macOS 菜单栏托盘弹窗
    trayOnDarwin: {
      base: { width: 180, height: 450 }
    },
    // 信息窗
    display: {
      base: { width: 1024, height: 600 },
      min: { width: 720, height: 422 }
    },
    // agent
    agent: {
      base: { width: 1024, height: 600 },
      min: { width: 720, height: 422 }
    },
    // 评论：细长竖条
    comments: {
      base: { width: 300, height: 800 },
      min: { width: 112, height: 300 },
      max: { width: 450, height: 1200 }
    },
    // 外部网页窗
    external: {
      base: { width: 1024, height: 600 },
      min: { width: 800, height: 469 }
    }
  } satisfies Record<string, WindowSizePreset>;
}
