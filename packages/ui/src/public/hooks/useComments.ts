import { CommentSort, CommentType } from "@mahiru/ui/public/enum";
import { useImmer } from "use-immer";
import { useCallback, useEffect, useState } from "react";
import { RequestStatus } from "@mahiru/ui/public/hooks/useRequestWrap";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";
import { Log } from "@mahiru/ui/public/utils/dev";
import NCM from "@mahiru/ui/public/source/netease/api";

export type CommentState = {
  data: NeteaseAPI.NeteaseComment[];
  totalComment: number;
  totalPageNo: number;
  currentPageNo: number;
  hasMore: boolean;
  cursor?: number;
};

export function useComments(props: {
  id: number;
  type: CommentType;
  sortType: CommentSort;
  pageSize?: number;
}) {
  const [status, setStatus] = useState<RequestStatus | "idle">("idle");
  const [comments, setComments] = useImmer<CommentState>(() => ({
    data: [],
    totalComment: 0,
    totalPageNo: 0,
    currentPageNo: 0,
    hasMore: true,
    cursor: undefined
  }));

  const propsRef = useLatestRef(props);
  const commentsRef = useLatestRef(comments);
  const statusRef = useLatestRef(status);
  const loadMore = useCallback(() => {
    const { id, sortType, type, pageSize } = propsRef.current;
    const { currentPageNo, cursor, hasMore } = commentsRef.current;
    const isLoading = statusRef.current === "loading";
    if (!hasMore || isLoading) return;

    setStatus("loading");
    NCM.Comment.get({
      id,
      pageNo: currentPageNo + 1,
      pageSize: pageSize || 25,
      sortType,
      type,
      cursor: currentPageNo > 0 ? cursor : undefined
    })
      .then((response) => {
        setComments((comments) => {
          comments.totalComment = response.data.totalCount;
          comments.hasMore = response.data.hasMore;
          comments.cursor = Number(response.data.cursor) || undefined;
          comments.totalPageNo = Math.ceil((response.data.totalCount || 0) / (pageSize || 25));
          comments.data = mergeUniqueComments(comments.data, response.data.comments);
          comments.currentPageNo++;
        });
        setStatus("success");
      })
      .catch((err) => {
        Log.error(`useComments(${id})`, err);
        setStatus("error");
      });
  }, [commentsRef, propsRef, setComments, statusRef]);

  useEffect(() => {
    setComments({
      data: [],
      totalComment: 0,
      totalPageNo: 0,
      currentPageNo: 0,
      hasMore: true,
      cursor: undefined
    });
  }, [
    setComments,
    // props变化时重置状态
    props.id,
    props.type,
    props.sortType,
    props.pageSize
  ]);

  // 初始时请求一次数据
  useEffect(() => {
    if (!props.id) return;
    if (!comments.hasMore || comments.currentPageNo !== 0) return;
    loadMore();
  }, [comments.currentPageNo, comments.hasMore, loadMore, props.id]);

  return { comments, status, loadMore };
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
