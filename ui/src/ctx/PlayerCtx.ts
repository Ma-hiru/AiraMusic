import { createContext, useContext } from "react";
import { usePlayerBind } from "@mahiru/ui/hook/usePlayerBind";
import { EqError } from "@mahiru/ui/utils/dev";

export const PlayerCtx = createContext<ReturnType<typeof usePlayerBind>>(
  {} as unknown as ReturnType<typeof usePlayerBind>
);

export const usePlayer = () => {
  const ctxValue = useContext(PlayerCtx);
  if (!ctxValue) {
    throw new EqError({
      message: "usePlayer must be used within a PlayerProvider",
      label: "ui/ctx/PlayerCtx.ts"
    });
  }
  return ctxValue;
};
