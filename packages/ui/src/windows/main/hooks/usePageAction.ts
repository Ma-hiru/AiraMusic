import { useCallback } from "react";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";
import { useNavigate } from "react-router-dom";

/** 多窗口页面跳转动作 */
export function usePageAction(
  data:
    | Nullable<MessageDataSend<"displayBus">["data"]>
    | NormalFunc<[], Nullable<MessageDataSend<"displayBus">["data"]>>
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
