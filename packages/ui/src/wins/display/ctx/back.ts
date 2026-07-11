import { useContext, createContext } from "react";

export const BackCtx = createContext({
  back: false,
  markBack: () => {}
});

export function useBack() {
  return useContext(BackCtx);
}
