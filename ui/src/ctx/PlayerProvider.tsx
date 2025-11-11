import { ReactNode } from "react";
import { PlayerCtx } from "./PlayerCtx";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  return <PlayerCtx.Provider value={{}}>{children}</PlayerCtx.Provider>;
}
