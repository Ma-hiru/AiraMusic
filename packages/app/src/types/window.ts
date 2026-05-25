import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

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
export type WindowExits = "IGNORE" | "CLOSE" | "DESTROY";

export type AppWindowCreatorProps = {
  options: Optional<BrowserWindowConstructorOptions>;
  id: WindowType;
  handleExits?: WindowExits;
  memoPos: boolean;
  loadURL: NormalFunc<[port: number], string>;
  onCreate?: NormalFunc<[win: BrowserWindow]>;
};
