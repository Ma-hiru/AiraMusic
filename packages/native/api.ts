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

export interface NativeAddon {
  /** win32 独占：设置任务栏封面，null 表示交还给 DWM 的实时预览 */
  setCover(handle: Buffer, image: null | Uint8Array): void;
  /**
   * macOS 独占：初始化菜单栏胶囊（托盘图标 + 歌词合并项），重复调用只更新图标与提示
   * 图标按模板图渲染：只取 alpha，用系统文字色随亮暗上色
   */
  initMenuBar(iconPath: string, tooltip: string): void;
  /** macOS 独占：更新菜单栏胶囊的悬浮提示 */
  setMenuBarToolTip(tooltip: string): void;
  /** macOS 独占：设置固定歌词视口宽度（pt），胶囊总宽随之变化 */
  setMenuBarWidth(width: number): void;
  /** macOS 独占：显示/隐藏整个菜单栏胶囊 */
  setMenuBarVisible(visible: boolean): void;
  /**
   * macOS 独占：更新歌词行
   * @param words 逐字时间轴（相对行首），空数组表示静态文本
   */
  setMenuLyric(text: string, words: MenuBarLyricWord[], onEvent?: MenuLyricEventHandler): void;
  /** macOS 独占：同步播放进度（相对行首，ms），原生以该基准推进逐字动画 */
  setMenuLyricProgress(elapsed: number, playing: boolean): void;
}
