import { startTransition, useEffect, useRef, useState } from "react";
import { CommentSort, CommentType } from "@mahiru/ui/public/enum";
import { Log } from "@mahiru/ui/public/utils/dev";
import { useImmer } from "use-immer";
import NCM_API from "@mahiru/ui/public/source/netease/api";
import { useStableObject } from "@mahiru/ui/public/hooks/useStableObject";

export function useComments(_props: Nullable<requestCommentProps>) {
  const [comments, setComments] = useImmer<CommentState>(() => ({
    data: [],
    totalComment: 0,
    totalPageNo: 0,
    currentPageNo: 0,
    hasMore: false,
    cursor: undefined
  }));
  const [status, setStatus] = useState<"loading" | "error" | "success">("success");
  const stableProps = useStableObject(_props);
  const cacheRef = useRef<Cache>(null);
  const commentsRef = useRef(comments);
  const queryKeyRef = useRef<Nullable<string>>(null);
  const cursorRef = useRef<Undefinable<number>>(undefined);
  const loadingPageRef = useRef<Nullable<number>>(null);
  const loadedPagesRef = useRef<Nullable<Set<number>>>(null);

  commentsRef.current = comments;
  cacheRef.current === null && (cacheRef.current = new Map());
  loadedPagesRef.current === null && (loadedPagesRef.current = new Set());

  useEffect(() => {
    if (!stableProps) return;

    const { type, id, pageSize, sortType = CommentSort.Recommend, pageNo } = stableProps;
    // 参数错误
    if (pageNo < 1 || !id) {
      Log.error({
        label: "useComment",
        message: "invalid pageNo or id"
      });
      startTransition(() => setStatus("error"));
      return;
    }
    // 参数变化，重置状态
    const queryKey = `${type}:${id}:${sortType}:${pageSize}`;
    const isNewQuery = queryKeyRef.current !== queryKey;
    if (isNewQuery) {
      queryKeyRef.current = queryKey;
      cursorRef.current = undefined;
      cacheRef.current = new Map();
      loadedPagesRef.current = new Set();
      loadingPageRef.current = null;
      setComments((draft) => {
        draft.data = [];
        draft.totalComment = 0;
        draft.totalPageNo = 0;
        draft.currentPageNo = 0;
        draft.hasMore = false;
        draft.cursor = undefined;
      });
    }
    // 更新状态函数
    const updateComments = (props: {
      data: NeteaseAPI.NeteaseComment[];
      totalComment: number;
      totalPageNo: number;
      hasMore: boolean;
      cursor?: number;
    }) => {
      const { data, totalComment, totalPageNo, hasMore, cursor } = props;
      startTransition(() => {
        setComments((draft) => {
          draft.currentPageNo = pageNo;
          draft.totalComment = totalComment;
          draft.totalPageNo = totalPageNo;
          draft.hasMore = hasMore;
          draft.cursor = cursor;
          if (pageNo === 1 || isNewQuery) {
            draft.data = data;
          } else {
            draft.data = mergeUniqueComments(draft.data, data);
          }
        });
        setStatus("success");
        cursorRef.current = cursor;
      });
    };
    // 请求前检查缓存，如果有缓存，则直接更新状态
    const cacheKey = `${queryKey}:${pageNo}`;
    const cached = cacheRef.current?.get(cacheKey);
    if (cached) return updateComments(cached);
    //  如果当前页已经加载过，则直接返回
    if (loadedPagesRef.current?.has(pageNo)) return;
    if (loadingPageRef.current === pageNo) return;
    let cancel = false;
    //  第一页正常加载，后面追加
    if (pageNo === 1) setStatus("loading");
    NCM_API.Comment.get({
      id,
      pageSize,
      pageNo,
      sortType,
      type,
      cursor: pageNo > 1 ? cursorRef.current : undefined
    })
      .then((response) => {
        if (cancel) return;
        const pageData = response.data.comments;
        const totalComment = response.data.totalCount;
        const hasMore = response.data.hasMore;
        const cursor = !response.data.cursor ? undefined : Number(response.data.cursor);
        const totalPageNo = Math.ceil(totalComment / pageSize);

        cacheRef.current?.set(cacheKey, {
          data: pageData,
          hasMore,
          cursor,
          totalComment,
          totalPageNo,
          currentPageNo: pageNo
        } satisfies CommentState);
        updateComments({
          data: pageData,
          totalComment,
          totalPageNo,
          hasMore,
          cursor
        });
      })
      .catch((err) => {
        if (cancel) return;
        Log.error({
          raw: err,
          label: "useComment",
          message: "failed to fetch comments"
        });
        startTransition(() => setStatus("error"));
      });
    return () => {
      cancel = true;
    };
  }, [stableProps, setComments]);

  return [comments, status] as const;
}

function mergeUniqueComments(
  oldList: NeteaseAPI.NeteaseComment[],
  newList: NeteaseAPI.NeteaseComment[]
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

export type requestCommentProps = {
  type: CommentType;
  id: number;
  pageSize: number;
  sortType?: CommentSort;
  pageNo: number;
};

export type CommentState = {
  data: NeteaseAPI.NeteaseComment[];
  totalComment: number;
  totalPageNo: number;
  currentPageNo: number;
  hasMore: boolean;
  cursor?: number;
};

type Cache = Nullable<Map<string, CommentState>>;
