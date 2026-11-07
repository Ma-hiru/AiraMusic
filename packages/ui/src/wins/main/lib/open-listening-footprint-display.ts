import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import type { ListeningFootprintScope } from "@/common/components/page/listening-footprint";

export async function openListeningFootprintDisplay(scope: ListeningFootprintScope) {
  await RendererWindow.display.reactReadyAwait();
  RendererIPCMessageBus.display.deliver({ type: "listening-footprint", ...scope });
}
