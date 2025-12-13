import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export type LayoutCtxType = {
  playerModalVisible: boolean;
  setPlayerModalVisible: NormalFunc<[visible: boolean]>;
  togglePlayerModalVisible: NormalFunc;
  background: Undefinable<string>;
  setBackground: NormalFunc<[bg?: string]>;
  backgroundThemeColor: string[];
  setBackgroundThemeColor: NormalFunc<[colors: string[]]>;
  sideBarOpen: boolean;
  setSideBarOpen: NormalFunc<[open: boolean]>;
  toggleSideBarOpen: NormalFunc;
};

export const LayoutCtx = createContext<LayoutCtxType>({
  playerModalVisible: false,
  setPlayerModalVisible: blank,
  togglePlayerModalVisible: blank,
  background: undefined,
  setBackground: blank,
  backgroundThemeColor: [],
  setBackgroundThemeColor: blank,
  sideBarOpen: false,
  setSideBarOpen: blank,
  toggleSideBarOpen: blank
});

export const useLayout = () => {
  const ctxValue = useContext(LayoutCtx);
  if (!ctxValue) {
    throw new EqError({
      message: "useLayout must be used within a LayoutProvider",
      label: "ui/LayoutCtx:useLayout"
    });
  }
  return ctxValue;
};

function blank() {}
