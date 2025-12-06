import ElectronStore from "electron-store";

export type StoreType = {
  window: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  mini: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  lyric: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  info: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  settings: {
    closeAppOption: "ask" | "exit";
  };
};

export const Store = new ElectronStore<StoreType>({
  defaults: {
    window: { width: 0, height: 0, x: 0, y: 0 },
    mini: { width: 0, height: 0, x: 0, y: 0 },
    lyric: { width: 0, height: 0, x: 0, y: 0 },
    info: { width: 0, height: 0, x: 0, y: 0 },
    settings: { closeAppOption: "ask" }
  }
});
