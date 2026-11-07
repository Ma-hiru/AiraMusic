import { useRef, useCallback } from "react";
import { Log } from "@/common/lib/log";
import AppToast from "@/common/components/display/toast";

/** 取消收藏动作配置 */
export interface UnstarOptions {
  id: number;
  successText?: string;
  request: PromiseFunc<[], unknown>;
  onRemoved: NormalFunc;
  onSynced?: NormalFunc;
}

/** 收藏项取消收藏：去重、Toast、异常兜底 */
export function useStarActions() {
  const pendingRef = useRef(new Set<number>());

  const unstar = useCallback(async (options: UnstarOptions) => {
    const { id, onSynced, onRemoved, request, successText = "已取消收藏" } = options;
    if (pendingRef.current.has(id)) return false;
    pendingRef.current.add(id);

    try {
      await request();
      onRemoved();
      onSynced?.();
      AppToast.show({
        type: "success",
        text: successText
      });
      return true;
    } catch (err) {
      Log.error("useStarActions", err);
      AppToast.show({
        type: "error",
        text: "取消收藏失败，请重试"
      });
      return false;
    } finally {
      pendingRef.current.delete(id);
    }
  }, []);

  return { unstar };
}
