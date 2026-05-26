import { useBack } from "@/wins/display/ctx/back";
import { useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useNavigate } from "react-router-dom";
import type { MessageData } from "@mahiru/ipc/renderer";

/** 多窗口页面跳转动作 */
export function useDisplayPageAction(
  data:
    | Nullable<MessageData<"mergeDisplay">>
    | NormalFunc<[], Nullable<MessageData<"mergeDisplay">>>
) {
  if (typeof data === "function") data = data();
  const { markBack } = useBack();
  const navigate = useNavigate();
  const dataRef = useLatestRef(data);

  const onPageAction = useCallback(async () => {
    if (!dataRef.current) return;
    RendererWindow.main.send("mergeDisplay", dataRef.current);
    markBack();
    navigate(-1);
  }, [dataRef, markBack, navigate]);

  return {
    onPageAction
  };
}
