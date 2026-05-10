import { useBack } from "@mahiru/ui/windows/display/ctx/back";
import { useCallback } from "react";
import { ElectronServicesWindow } from "@mahiru/ui/public/source/electron/services";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";
import { useNavigate } from "react-router-dom";

/** 多窗口页面跳转动作 */
export function useDisplayPageAction(
  data:
    | Nullable<MessageDataSend<"mergeDisplay">["data"]>
    | NormalFunc<[], Nullable<MessageDataSend<"mergeDisplay">["data"]>>
) {
  if (typeof data === "function") data = data();
  const { markBack } = useBack();
  const navigate = useNavigate();
  const dataRef = useLatestRef(data);

  const onPageAction = useCallback(async () => {
    if (!dataRef.current) return;
    ElectronServicesWindow.main.send("mergeDisplay", dataRef.current);
    markBack();
    navigate(-1);
  }, [dataRef, markBack, navigate]);

  return {
    onPageAction
  };
}
