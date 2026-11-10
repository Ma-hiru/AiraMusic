export type MenuLyricEventKind = "click" | "right-click" | "double-click";

/** AppKit 屏幕坐标（左下原点）；菜单定位时 JS 只用 x/width，y 贴 workArea 顶边 */
export interface MenuLyricEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: MenuLyricEventKind;
  /** 胶囊所在屏的 CGDirectDisplayID，与 Electron `display.id` 同源；0 表示没取到 */
  displayId: number;
}

/** 菜单栏胶囊中的一个歌词词，时间相对行首 */
export interface MenuBarLyricWord {
  /** 相对行首的起始时间 ms */
  startMs: number;
  /** 相对行首的结束时间 ms */
  endMs: number;
  /** 词文本（已剔除注音） */
  text: string;
}

/** napi ThreadsafeFunction 默认 err-first */
export type MenuLyricEventHandler = (error: null | Error, event: MenuLyricEvent) => void;

export type TaskbarAction = "next" | "play" | "pause" | "previous";

export type TaskbarActionHandler = (error: null | Error, action: TaskbarAction) => void;

export interface TaskbarButtonIcons {
  next: Uint8Array;
  play: Uint8Array;
  pause: Uint8Array;
  previous: Uint8Array;
}

/**
 * Windows 产物导出的全部能力。
 * `win.rs` 只在 Windows 目标编译，因此 macOS 产物里根本不存在这些函数。
 */
export interface WindowsNativeAddon {
  /** 在主窗口的任务栏预览工具栏上挂三个播放按钮 */
  setTaskbarButtons(
    handle: Buffer,
    playing: boolean,
    icons: TaskbarButtonIcons,
    onAction: TaskbarActionHandler
  ): void;
  /** 设置主窗口的任务栏缩略图封面，null 表示撤销 iconic 表示、恢复系统实时预览 */
  setCover(handle: Buffer, image: null | Uint8Array): void;
}

/**
 * macOS 产物导出的全部能力。
 * `darwin.rs` 只在 macOS 目标编译，因此 Windows 产物里根本不存在这些函数。
 */
export interface DarwinNativeAddon {
  /**
   * 初始化菜单栏胶囊（托盘图标 + 歌词合并项），重复调用只更新图标与提示。
   * 图标按模板图渲染：只取 alpha，用系统文字色随亮暗上色
   */
  initMenuBar(iconPath: string, tooltip: string): void;
  /** 更新菜单栏胶囊的悬浮提示 */
  setMenuBarToolTip(tooltip: string): void;
  /** 设置固定歌词视口宽度（pt），胶囊总宽随之变化 */
  setMenuBarWidth(width: number): void;
  /** 显示/隐藏整个菜单栏胶囊 */
  setMenuBarVisible(visible: boolean): void;
  /**
   * 更新歌词行
   * @param words 逐字时间轴（相对行首），空数组表示静态文本
   */
  setMenuLyric(text: string, words: MenuBarLyricWord[], onEvent?: MenuLyricEventHandler): void;
  /** 同步播放进度（相对行首，ms），原生以该基准推进逐字动画 */
  setMenuLyricProgress(elapsed: number, playing: boolean): void;
}

/**
 * 原生模块的载入类型。运行时只实现当前平台的那一半，
 * 业务侧请通过 `MainNativeAddon.windows` / `MainNativeAddon.darwin` 取用，
 * 不要直接把返回值当成全量接口。
 */
export type NativeAddon = DarwinNativeAddon | WindowsNativeAddon;
