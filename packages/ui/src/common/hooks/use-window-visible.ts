import { Log } from "@/common/lib/log";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow, RendererWindowVisible } from "@/common/lib/window";

const current_visible = new RendererWindowVisible(RendererWindow.current);

current_visible.addEventListener("visible-change", (e) => Log.info("visible-change", e));

export function useWindowVisible(): boolean {
  return useListenable(current_visible).visible;
}
