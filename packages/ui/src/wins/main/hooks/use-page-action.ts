import { useCallback } from "react";
import { ElectronServicesBus, ElectronServicesWindow } from "@/common/source/electron/services";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useNavigate } from "react-router-dom";
import type { MessageData } from "@mahiru/ipc/renderer";

/** 多窗口页面跳转动作 */
export function usePageAction(
  data: Nullable<MessageData<"displayBus">> | NormalFunc<[], Nullable<MessageData<"displayBus">>>
) {
  if (typeof data === "function") data = data();

  const navigate = useNavigate();
  const dataRef = useLatestRef(data);

  const onPageAction = useCallback(async () => {
    if (!dataRef.current) return;
    await ElectronServicesWindow.display.openAwait();
    ElectronServicesBus.display.send(dataRef.current);
    navigate(-1);
  }, [dataRef, navigate]);

  return {
    onPageAction
  };
}
