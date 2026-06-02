import { useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useNavigate } from "react-router-dom";
import type { MessageData } from "@mahiru/ipc/renderer";

/** 多窗口页面跳转动作 */
export function useDisplayAction(
  data: Nullable<MessageData<"displayBus">> | NormalFunc<[], Nullable<MessageData<"displayBus">>>
) {
  if (typeof data === "function") data = data();

  const navigate = useNavigate();
  const dataRef = useLatestRef(data);

  const onPageAction = useCallback(async () => {
    if (!dataRef.current) return;
    await RendererWindow.display.reactReadyAwait();
    RendererEventBus.display.send(dataRef.current);
    navigate(-1);
  }, [dataRef, navigate]);

  return {
    onPageAction
  };
}
