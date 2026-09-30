import { useAtomValue } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useWindowVisible } from "@/common/hooks/use-window-visible";

export function usePlayerViewVisible(view?: "bar" | "player") {
  const playModal = useAtomValue(playModalAtom);
  const visible = useWindowVisible();
  return visible && (view === undefined || view === (playModal ? "player" : "bar"));
}
