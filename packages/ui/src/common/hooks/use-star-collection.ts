import { useRef, useState, useEffect, useCallback, startTransition } from "react";
import { Log } from "@/common/lib/log";
import type { NeteaseStarPage } from "@/common/netease/models";

import { useLatestRef } from "./use-latest-ref";
import { type RequestStatus } from "./use-request-wrap";

export type StarCollectionStatus = "idle" | RequestStatus;

export type StarCollectionPage<T> = NeteaseStarPage<T>;

type StarCollectionState<T> = {
  data: T[];
  count: number;
  hasMore: boolean;
  /** 已成功加载的页数 */
  page: number;
  /** 下一页在服务端列表中的起始位置，取消收藏后随列表收缩 */
  nextOffset: number;
};

interface UseStarCollectionProps<T> {
  /**
   * 按 offset/limit 拉取一页收藏数据。
   * bypassCache 为 true 时应跳过 service 缓存（手动重载 / 页面重新激活）。
   */
  fetchPage: (
    offset: number,
    limit: number,
    signal: AbortSignal,
    bypassCache: boolean
  ) => Promise<StarCollectionPage<T>>;
  /** 收藏项唯一标识 */
  getId: (item: T) => number;
  /** 当前页面是否处于激活路由，用于重新激活时静默刷新 */
  active?: boolean;
  /** 每页数量 */
  pageSize?: number;
  /** 是否立即加载 */
  enabled?: boolean;
  /** 递增时跳过缓存重载首页 */
  refreshToken?: number;
}

/**
 * 收藏列表分页状态机。
 * 只处理「加载一页 / 追加一页 / 重载 / 本地移除」，具体请求由调用方注入。
 */
export function useStarCollection<T>({
  getId,
  fetchPage,
  refreshToken,
  active = true,
  pageSize = 30,
  enabled = true
}: UseStarCollectionProps<T>) {
  const [status, setStatus] = useState<StarCollectionStatus>("idle");
  const [state, setState] = useState<StarCollectionState<T>>(() => ({
    data: [],
    count: 0,
    hasMore: true,
    page: 0,
    nextOffset: 0
  }));

  const propsRef = useLatestRef({ fetchPage, getId, pageSize });
  const stateRef = useLatestRef(state);
  const statusRef = useLatestRef(status);
  const controllerRef = useRef<Nullable<AbortController>>(null);
  const requestIDRef = useRef(0);

  const run = useCallback(
    async (offset: number, mode: "append" | "replace", bypassCache = false) => {
      const { getId, pageSize, fetchPage } = propsRef.current;

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestID = ++requestIDRef.current;
      const isCurrent = () => !controller.signal.aborted && requestID === requestIDRef.current;

      setStatus("loading");
      try {
        const res = await fetchPage(offset, pageSize, controller.signal, bypassCache);
        if (!isCurrent()) return;

        startTransition(() => {
          setState((prev) =>
            isCurrent()
              ? {
                  data: mode === "replace" ? res.items : mergeUnique(prev.data, res.items, getId),
                  count: res.count,
                  hasMore: res.hasMore,
                  page: mode === "replace" ? 1 : prev.page + 1,
                  nextOffset: offset + res.items.length
                }
              : prev
          );
          setStatus((prev) => (isCurrent() ? "success" : prev));
        });
      } catch (err) {
        if (!isCurrent()) return;
        Log.error("useStarCollection", err);
        setStatus("error");
      }
    },
    [propsRef, setState]
  );

  // 首次加载
  useEffect(() => {
    if (!enabled) return;
    void run(0, "replace");
  }, [enabled, run]);

  // 页面重新激活时静默刷新首页，跳过缓存
  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (active && !prevActiveRef.current) void run(0, "replace", true);
    prevActiveRef.current = active;
  }, [active, run]);

  // 外部触发刷新（工具栏刷新按钮）
  const refreshTokenRef = useRef(refreshToken);
  useEffect(() => {
    if (refreshToken === undefined || refreshToken === refreshTokenRef.current) return;
    refreshTokenRef.current = refreshToken;
    void run(0, "replace", true);
  }, [refreshToken, run]);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const loadMore = useCallback(() => {
    if (statusRef.current !== "success" || !stateRef.current.hasMore) return;
    void run(stateRef.current.nextOffset, "append");
  }, [run, stateRef, statusRef]);

  const reload = useCallback(() => {
    void run(0, "replace", true);
  }, [run]);

  const remove = useCallback(
    (id: number) => {
      if (!stateRef.current.data.some((item) => propsRef.current.getId(item) === id)) return;
      // 在途响应仍使用删除前的偏移，取消后由下一次加载从修正的位置继续。
      controllerRef.current?.abort();
      setStatus("success");
      setState((prev) => {
        if (!prev.data.some((item) => propsRef.current.getId(item) === id)) return prev;
        return {
          ...prev,
          data: prev.data.filter((item) => propsRef.current.getId(item) !== id),
          count: Math.max(0, prev.count - 1),
          nextOffset: Math.max(0, prev.nextOffset - 1)
        };
      });
    },
    [propsRef, stateRef]
  );

  return {
    data: state.data,
    count: state.count,
    page: state.page,
    status,
    hasMore: state.hasMore,
    loadMore,
    reload,
    remove
  };
}

function mergeUnique<T>(current: T[], next: T[], getId: (item: T) => number) {
  const exists = new Set(current.map(getId));
  const result = [...current];
  for (const item of next) {
    const id = getId(item);
    if (exists.has(id)) continue;
    exists.add(id);
    result.push(item);
  }
  return result;
}
