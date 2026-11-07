import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBack } from "@/wins/display/ctx/back";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import type { MessageData } from "@mahiru/ipc/types";

/** 多窗口页面跳转动作 */
export function useDisplayPageAction(
  data: Nullable<MessageData<"bus_display">> | NormalFunc<[], Nullable<MessageData<"bus_display">>>
) {
  const { markBack } = useBack();
  const navigate = useNavigate();
  const dataRef = useLatestRef(data);

  const onPageAction = useCallback(async () => {
    const data = typeof dataRef.current === "function" ? dataRef.current() : dataRef.current;
    if (!data) return;
    RendererIPCMessageBus.display.deliver(data, "main");
    markBack();
    navigate(-1);
  }, [dataRef, markBack, navigate]);

  return {
    onPageAction
  };
}
