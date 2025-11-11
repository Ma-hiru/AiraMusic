import { createContext, useContext } from "react";

export type PlayerCtxType = object;

export const PlayerCtx = createContext<PlayerCtxType>({});

export const usePlayer = () => {
  return useContext(PlayerCtx);
};
