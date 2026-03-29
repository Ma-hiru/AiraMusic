import { useCallback, useEffect, useRef, useState } from "react";
import { CommentSort, CommentType } from "@mahiru/ui/public/enum";
import NCM_API from "@mahiru/ui/public/api";

import { EqError, Log } from "@mahiru/ui/public/utils/dev";

interface UseCommentProps {
  type: CommentType;
  id: number;
  pageSize: number;
  sortType?: CommentSort;
}

export function useComment({
  type,
  id,
  pageSize,
  sortType = CommentSort.Recommend
}: UseCommentProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [totalComment, setTotalComment] = useState(0);
  const [currentPageNo, setCurrentPageNo] = useState(0);
  const [comments, setComments] = useState<NeteaseAPI.NeteaseComment[]>([]);
  const commentsCache = useRef<Map<number, NeteaseAPI.NeteaseComment[]>>(null);
  const pageCursor = useRef({
    hasMore: false,
    cursor: undefined as Undefinable<number>
  });
  const totalPageNo = Math.ceil(totalComment / pageSize);

  const requestComment = useCallback(
    async (pageNo: number) => {
      if (pageNo < 1 || !id) return;
      if (commentsCache.current?.has(pageNo)) {
        setCurrentPageNo(pageNo);
        setComments(commentsCache.current.get(pageNo) || []);
        return;
      }
      setLoading(true);
      setFailed(false);
      NCM_API.Comment.get({
        id,
        pageSize,
        pageNo,
        sortType,
        type,
        cursor: pageCursor.current.hasMore ? pageCursor.current.cursor : undefined
      })
        .then((response) => {
          setComments(response.data.comments);
          setCurrentPageNo(pageNo);
          setTotalComment(response.data.totalCount);
          commentsCache.current?.set(pageNo, response.data.comments);
          pageCursor.current.hasMore = response.data.hasMore;
          pageCursor.current.cursor = Number(response.data.cursor);
        })
        .catch((err) => {
          Log.error(
            new EqError({
              raw: err,
              label: "useComment",
              message: "failed to fetch comments"
            })
          );
          setFailed(true);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [id, pageSize, sortType, type]
  );

  const clear = useCallback(() => {
    setComments([]);
    setCurrentPageNo(0);
    setTotalComment(0);
    commentsCache.current = new Map<number, NeteaseAPI.NeteaseComment[]>();
    pageCursor.current.hasMore = false;
    pageCursor.current.cursor = undefined;
    void requestComment(1);
  }, [requestComment]);

  useEffect(clear, [clear]);

  return {
    loading,
    failed,
    totalComment,
    currentPageNo,
    comments,
    totalPageNo,
    requestComment,
    clear,
    pageCursor
  };
}
