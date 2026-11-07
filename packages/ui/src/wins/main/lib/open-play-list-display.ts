import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";

export async function openPlayListDisplay() {
  await RendererWindow.display.reactReadyAwait();
  RendererIPCMessageBus.display.deliver({ type: "play-list" });
}
