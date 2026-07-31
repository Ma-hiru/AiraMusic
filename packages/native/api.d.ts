export type MenuLyricEventKind = "click" | "right-click" | "double-click";

/** AppKit 屏幕坐标（左下原点）；菜单定位时 JS 只用 x/width，y 贴 workArea 顶边 */
export interface MenuLyricEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: MenuLyricEventKind;
}

/** napi ThreadsafeFunction 默认 err-first */
export type MenuLyricEventHandler = (error: null | Error, event: MenuLyricEvent) => void;

export interface NativeAddon {
  setLivePreview(handle: Buffer, preview: Uint8Array): void;
  setCover(handle: Buffer, image: Nullable<Uint8Array>, preview?: Nullable<Uint8Array>): void;
  setMenuLyric(
    handle: Buffer,
    lyric: string,
    pingPong: boolean,
    duration: number,
    gap: number,
    width: number,
    onEvent?: MenuLyricEventHandler
  ): void;
}
