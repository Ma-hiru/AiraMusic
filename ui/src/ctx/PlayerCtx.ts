import { createContext, useContext } from "react";
import { useSong } from "@mahiru/ui/hook/useSong";
import { EqError } from "@mahiru/ui/utils/dev";

export const PlayerCtx = createContext<ReturnType<typeof useSong>>(
  {} as unknown as ReturnType<typeof useSong>
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
