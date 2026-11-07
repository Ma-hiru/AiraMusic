import { useEffect, useSyncExternalStore } from "react";
import { Log } from "@/common/lib/log";
import { CommentType } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIComment } from "@/common/netease/api";

/**
 * 评论数缓存：/comment/info/list 支持批量且不需要登录
 * 单曲场景按 id 现取一次并记忆；组件订阅缓存，菜单打开期间就地刷新，不重建菜单
 */
const counts = new Map<number, number>();
const listeners = new Set<NormalFunc>();
const loading = new Set<number>();

function subscribe(listener: NormalFunc) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(id: number) {
  return counts.get(id);
}

function load(id: number) {
  if (counts.has(id) || loading.has(id)) return;
  loading.add(id);
  NeteaseAPIComment.info({ ids: [id], type: CommentType.Song })
    .then((response) => {
      const count = response.data?.[0]?.commentCount;
      if (typeof count === "number") counts.set(id, count);
    })
    .catch((err) => Log.warn("CommentCount", "comment info request failed", err))
    .finally(() => {
      loading.delete(id);
      for (const listener of listeners) listener();
    });
}

/** 曲目评论数，未取到或为 0 时不渲染 */
export const CommentCount = ({ id }: { id: number }) => {
  const count = useSyncExternalStore(subscribe, () => getSnapshot(id));
  useEffect(() => {
    if (count === undefined) load(id);
  }, [count, id]);
  if (count === undefined || count <= 0) return null;
  return (
    <span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums opacity-45">
      {RendererFormat.count(count)}
    </span>
  );
};

export default CommentCount;
