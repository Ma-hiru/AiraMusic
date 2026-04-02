import ElectronStore from "electron-store";
import { isDev } from "../utils/dev";

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

isDev && AppStore.clear();
