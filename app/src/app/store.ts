import ElectronStore from "electron-store";

export type StoreType = Record<
  WindowType,
  {
    width: number;
    height: number;
    x: number;
    y: number;
  }
>;

export const AppStore = new ElectronStore<StoreType>();
