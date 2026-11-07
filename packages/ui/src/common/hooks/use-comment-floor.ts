import { useRef, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { CommentType } from "@/common/enum";
import { NeteaseAPIComment } from "@/common/netease/api";

import { type RequestStatus } from "./use-request-wrap";

/** 楼层分页的缓存条目，折叠后再次展开可直接复用 */
type FloorCacheEntry = {
  data: NeteaseAPI.NeteaseFloorComment[];
  /** 是否已完成首页请求，用于区分「未加载」与「确实没有回复」 */
  loaded: boolean;
  /** 下一页游标，对应接口返回的 data.time */
  cursor: number;
  hasMore: boolean;
  /** 楼内回复总数，用于展示剩余条数 */
  total: number;
};

const EMPTY_ENTRY: FloorCacheEntry = {
  data: [],
  loaded: false,
  cursor: 0,
  hasMore: false,
  total: 0
};
/** 缓存条目上限，避免长时间挂机后无限增长 */
const CACHE_LIMIT = 200;
const cache = new Map<string, FloorCacheEntry>();

function buildKey(id?: number, type?: CommentType, parentCommentId?: number) {
  if (!id || type == null || !parentCommentId) return null;
  return `${type}:${id}:${parentCommentId}`;
}

function readCache(key: Nullable<string>) {
  return (key && cache.get(key)) || EMPTY_ENTRY;
}

function writeCache(key: Nullable<string>, entry: FloorCacheEntry) {
  if (!key) return;
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function mergeFloors(
  oldList: NeteaseAPI.NeteaseFloorComment[],
  newList: NeteaseAPI.NeteaseFloorComment[]
) {
  const exists = new Set(oldList.map((item) => item.commentId));
  const result = [...oldList];
  for (const item of newList) {
    if (exists.has(item.commentId)) continue;
    exists.add(item.commentId);
    result.push(item);
  }
  return result;
}

/**
 * 楼层（楼中楼）评论：展开、分页与缓存
 * @desc 列表接口只返回 replyCount，楼层数据需按需请求 /comment/floor
 * */
export function useCommentFloor(props: {
  /** 资源 id，如歌曲 id */
  id?: number;
  /** 资源类型 */
  type?: CommentType;
  /** 楼层评论 id */
  parentCommentId: number;
  /** 单页条数，默认 10 */
  pageSize?: number;
}) {
  const { id, type, pageSize = 10, parentCommentId } = props;
  const key = buildKey(id, type, parentCommentId);

  const [expanded, setExpanded] = useState(false);
  const [entry, setEntry] = useState<FloorCacheEntry>(() => readCache(key));
  const [status, setStatus] = useState<"idle" | RequestStatus>(() =>
    readCache(key).loaded ? "success" : "idle"
  );

  const abortRef = useRef<Nullable<AbortController>>(null);
  const inFlightRef = useRef(false);
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const statusRef = useRef(status);
  statusRef.current = status;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const prevKeyRef = useRef(key);

  // 资源或类型变化时重置，避免楼层串到另一条评论上
  useEffect(() => {
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    abortRef.current?.abort();
    inFlightRef.current = false;
    const cached = readCache(key);
    setExpanded(false);
    setStatus(cached.loaded ? "success" : "idle");
    setEntry(cached);
  }, [key]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const request = useCallback(
    async (mode: "more" | "initial") => {
      if (!key || !id || type == null) return;
      if (inFlightRef.current) return;

      const current = entryRef.current;
      if (mode === "initial" && current.loaded) return;
      if (mode === "more" && (!current.hasMore || statusRef.current === "loading")) return;

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      inFlightRef.current = true;
      setStatus("loading");

      try {
        const response = await NeteaseAPIComment.floor(
          {
            id,
            type,
            parentCommentId,
            limit: pageSize,
            // 首次请求不传游标，翻页时传上一页返回的 time
            time: mode === "more" ? current.cursor || undefined : undefined
          },
          controller.signal
        );
        if (controller.signal.aborted) return;

        const page = response?.data;
        if (!page) throw new Error("empty comment floor response");

        const base = mode === "more" ? entryRef.current : EMPTY_ENTRY;
        const next: FloorCacheEntry = {
          data: mergeFloors(base.data, page.comments || []),
          loaded: true,
          cursor: Number(page.time) || 0,
          hasMore: Boolean(page.hasMore),
          // 翻页时上游 totalCount 可能返回 0，保留首次统计值
          total: page.totalCount > 0 ? page.totalCount : base.total
        };

        setEntry(next);
        entryRef.current = next;
        writeCache(key, next);
        setStatus("success");
      } catch (err) {
        if (controller.signal.aborted) return;
        Log.error(`useCommentFloor(${key})`, err);
        setStatus("error");
      } finally {
        if (abortRef.current === controller) inFlightRef.current = false;
      }
    },
    [id, key, pageSize, parentCommentId, type]
  );

  const expand = useCallback(() => {
    setExpanded(true);
    void request("initial");
  }, [request]);

  const collapse = useCallback(() => setExpanded(false), []);

  const toggle = useCallback(() => {
    if (expandedRef.current) {
      setExpanded(false);
      return;
    }
    expand();
  }, [expand]);

  const loadMore = useCallback(() => {
    void request("more");
  }, [request]);

  const retry = useCallback(() => {
    void request(entryRef.current.loaded ? "more" : "initial");
  }, [request]);

  const updateLiked = useCallback(
    (commentId: number, liked: boolean) => {
      if (!key) return;
      const current = prevKeyRef.current === key ? entryRef.current : readCache(key);
      const next = {
        ...current,
        data: current.data.map((comment) =>
          comment.commentId === commentId ? { ...comment, liked } : comment
        )
      };
      writeCache(key, next);
      if (prevKeyRef.current !== key) return;
      entryRef.current = next;
      setEntry(next);
    },
    [key]
  );

  return {
    expanded,
    status,
    floors: entry.data,
    hasMore: entry.hasMore,
    total: entry.total,
    expand,
    collapse,
    toggle,
    loadMore,
    retry,
    updateLiked
  };
}
