import { useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useNavigate } from "react-router-dom";
import type { MessageData } from "@mahiru/ipc/types";

/** 多窗口页面跳转动作 */
export function useDisplayAction(
  data: Nullable<MessageData<"bus_display">> | NormalFunc<[], Nullable<MessageData<"bus_display">>>
) {
  if (typeof data === "function") data = data();

  const navigate = useNavigate();
  const dataRef = useLatestRef(data);

  const onPageAction = useCallback(async () => {
    if (!dataRef.current) return;
    await RendererWindow.display.reactReadyAwait();
    RendererIPCMessageBus.display.deliver(dataRef.current);
    navigate(-1);
  }, [dataRef, navigate]);

  return {
    onPageAction
  };
}
