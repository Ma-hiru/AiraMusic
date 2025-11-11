import { ReactNode } from "react";
import { SettingsCtx } from "@mahiru/ui/ctx/SettingsCtx";

export default function SettingsProvider({ children }: { children: ReactNode }) {
  return <SettingsCtx.Provider value={{}}>{children}</SettingsCtx.Provider>;
}
