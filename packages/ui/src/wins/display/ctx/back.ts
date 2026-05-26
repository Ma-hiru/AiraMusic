import { createContext, useContext } from "react";

export const BackCtx = createContext({
  back: false,
  markBack: () => {}
});

export function useBack() {
  return useContext(BackCtx);
}
