import { useEffect } from "react";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererWindow } from "@/common/lib/window";
import { useStableObject } from "@/common/hooks/use-stable-object";
import type { AgentFocusContext } from "@mahiru/ipc/types";

export function useAgentFocusCtx(ctx: AgentFocusContext, active: boolean) {
  const stableCtx = useStableObject(ctx);

  useEffect(() => {
    if (!active) return;

    const send = () => {
      RendererIPC.MessageChannel.send("bus_deliver_focus_context", "process", stableCtx);
    };

    send();
    return RendererWindow.current.addEventListener("focus", send);
  }, [active, stableCtx]);
}
