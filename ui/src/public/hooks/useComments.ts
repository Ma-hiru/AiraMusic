import { useActionState } from "react";
import { CommentSort, CommentType } from "@mahiru/ui/public/enum";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import NCM_API from "@mahiru/ui/public/api";

export function useComments() {
  return useActionState<CommentState, requestCommentProps>(
    async (comments, { type, id, pageSize, sortType = CommentSort.Recommend, pageNo }) => {
      if (pageNo < 1 || !id) return comments.copyWith({ failed: true });
      if (comments.cache === null) comments.cache = new Map();
      if (comments.cache.has(pageNo)) {
        return comments.copyWith({
          currentPageNo: pageNo,
          data: comments.cache.get(pageNo) || [],
          failed: false
        });
      }
      try {
        const response = await NCM_API.Comment.get({
          id,
          pageSize,
          pageNo,
          sortType,
          type,
          cursor: comments.hasMore ? comments.cursor : undefined
        });
        comments.cache?.set(pageNo, response.data.comments);
        return comments.copyWith({
          currentPageNo: pageNo,
          data: response.data.comments,
          totalComment: response.data.totalCount,
          totalPageNo: Math.ceil(response.data.totalCount / pageSize),
          hasMore: response.data.hasMore,
          cursor: Number(response.data.cursor),
          failed: false
        });
      } catch (err) {
        Log.error(
          new EqError({
            raw: err,
            label: "useComment",
            message: "failed to fetch comments"
          })
        );
        return comments.copyWith({
          ...comments,
          failed: true
        });
      }
    },
    new CommentState()
  );
}

export interface requestCommentProps {
  type: CommentType;
  id: number;
  pageSize: number;
  sortType?: CommentSort;
  pageNo: number;
}

export class CommentState {
  data;
  totalComment;
  totalPageNo;
  currentPageNo;
  hasMore;
  cursor;
  cache;
  failed;

  constructor(props?: {
    data?: NeteaseAPI.NeteaseComment[];
    totalComment?: number;
    totalPageNo?: number;
    currentPageNo?: number;
    hasMore?: boolean;
    cursor?: number | undefined;
    cache?: Nullable<Map<number, NeteaseAPI.NeteaseComment[]>>;
    failed?: boolean;
  }) {
    this.data = props?.data ?? [];
    this.totalComment = props?.totalComment ?? 0;
    this.totalPageNo = props?.totalPageNo ?? 0;
    this.currentPageNo = props?.currentPageNo ?? 0;
    this.hasMore = props?.hasMore ?? false;
    this.cache = props?.cache ?? null;
    this.failed = props?.failed ?? false;
    this.cursor = props?.cursor;
  }

  copyWith(props: Partial<CommentState>) {
    return new CommentState({
      ...this,
      ...props
    });
  }
}
