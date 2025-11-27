import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export type LayoutCtxType = {
  PlayerModalVisible: boolean;
  TogglePlayerModalVisible: (show: boolean) => void;
};

export const LayoutCtx = createContext<LayoutCtxType>({
  PlayerModalVisible: false,
  TogglePlayerModalVisible: () => {}
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
