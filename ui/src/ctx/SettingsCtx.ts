import { createContext, useContext } from "react";

export type SettingsCtxType = object;

export const SettingsCtx = createContext<SettingsCtxType>({});

export const useSettings = () => {
  return useContext(SettingsCtx);
};
