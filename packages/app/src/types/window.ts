import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

export interface WindowSize {
  width: number;
  height: number;
}

/**
 * 窗口尺寸预设(DIP) \
 * 统一策略 idealFit \
 * base 是理想尺寸，工作区放得下就用、放不下才等比收缩 \
 * base 同时定义窗口的宽高比 \
 * min/max 为用户拖拽 resize 的边界
 */
export interface WindowSizePreset {
  base: WindowSize;
  /** 绝对最小尺寸（DIP，resize 下限）。缺省时取 base。 */
  min?: WindowSize;
  /** 绝对最大尺寸（DIP，resize 上限）。缺省时取 base。 */
  max?: WindowSize;
}

/** 解析后的窗口尺寸：base 为最终初始尺寸，min/max 为 resize 边界，均为 DIP。 */
export interface ResolvedWindowSize {
  base: WindowSize;
  min: WindowSize;
  max: WindowSize;
}

export type WindowExits = "IGNORE" | "CLOSE" | "DESTROY";

export type AppWindowCreatorProps = {
  options: Optional<BrowserWindowConstructorOptions>;
  id: WindowType;
  handleExits?: WindowExits;
  memoPos: boolean;
  loadURL: NormalFunc<[port: number], string>;
  onCreate?: NormalFunc<[win: BrowserWindow]>;
};
