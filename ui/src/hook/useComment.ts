import { useCallback, useEffect, useRef, useState } from "react";
import { CommentSort, CommentType, getCommentNew } from "@mahiru/ui/api/comment";
import { EqError, Log } from "@mahiru/ui/utils/dev";

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
  const [comments, setComments] = useState<NeteaseComment[]>([]);
  const pageCursor = useRef({
    hasMore: false,
    cursor: undefined as Undefinable<number>
  });
  const totalPageNo = Math.ceil(totalComment / pageSize);

  const requestComment = useCallback(
    async (pageNo: number) => {
      setLoading(true);
      setFailed(false);
      getCommentNew({
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
          pageCursor.current.hasMore = response.data.hasMore;
          pageCursor.current.cursor = Number(response.data.cursor);
        })
        .catch((err) => {
          Log.error(
            new EqError({
              raw: err,
              label: "hook/useComment.ts:requestComment",
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
    clear
  };
}
