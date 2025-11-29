import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export type LayoutCtxType = {
  PlayerModalVisible: boolean;
  setPlayerModalVisible: NormalFunc<[visible: boolean]>;
  TogglePlayerModalVisible: NormalFunc;
  background: Undefinable<string>;
  setBackground: NormalFunc<[bg?: string]>;
  backgroundThemeColor: string[];
  setBackgroundThemeColor: NormalFunc<[colors: string[]]>;
};

export const LayoutCtx = createContext<LayoutCtxType>({
  PlayerModalVisible: false,
  setPlayerModalVisible: blank,
  TogglePlayerModalVisible: blank,
  background: undefined,
  setBackground: blank,
  backgroundThemeColor: [],
  setBackgroundThemeColor: blank
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
