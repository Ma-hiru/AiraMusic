import { cx } from "@emotion/css";
import { memo, useRef, type FC, useMemo, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { CommentSort, CommentType } from "@/common/enum";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPIComment } from "@/common/netease/api";
import { useListenable } from "@/common/hooks/use-listenable";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Item from "@/wins/comments/page/item";
import NoDrag from "@/common/components/layout/drag/no-drag";

const edgeFadeMask =
  "linear-gradient(to bottom, transparent 0, #000 min(12%, 56px), #000 calc(100% - min(12%, 56px)), transparent 100%)";

interface RadioCommentProps {
  className?: string;
}

const RadioComment: FC<RadioCommentProps> = ({ className }) => {
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const track = trackMetaBus.data?.track?.detail;
  const { data, status, fetchData } = useRequestStatusWrap(fetchHottestComment);
  const { reload } = useRequestAutoRun(fetchData, [track?.id]);

  const openComment = useCallback(async () => {
    if (!track?.id) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({
      id: track?.id,
      type: "track"
    });
  }, [track?.id]);

  const empty = useMemo(() => {
    if (status === "error")
      return (
        <span
          className="text-[11px] group-hover:opacity-70 font-semibold duration-300 transition-all ease-in-out"
          onClick={reload}>
          加载失败点击重试
        </span>
      );
    if (data == null) return <span className="text-[11px] font-semibold">暂无评论</span>;
  }, [data, reload, status]);

  const scrollRef = useRef(null);
  useScrollAutoHide(scrollRef);

  return (
    <NoDrag
      className={cx("flex flex-col justify-between items-center gap-2 cursor-pointer", className)}>
      <section
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar scrollbar-show px-1 py-3.5"
        style={{
          maskImage: edgeFadeMask,
          WebkitMaskImage: edgeFadeMask
        }}>
        {data?.map((i, idx) => (
          <Item key={i.commentId} data={i} avatar={false} border={idx > 0} small reverse />
        ))}
        {empty}
      </section>
      <button
        className="text-[11px] font-semibold cursor-pointer hover:opacity-70 duration-300 transition-all ease-in-out"
        onClick={openComment}>
        {"打开评论区 >"}
      </button>
    </NoDrag>
  );
};

export default memo(RadioComment);

const fetchHottestComment = (id?: number): Promise<Nullable<NeteaseAPI.NeteaseComment[]>> => {
  if (!id) return Promise.resolve(null);
  return NeteaseAPIComment.get({
    id,
    type: CommentType.Song,
    sortType: CommentSort.Hot,
    pageNo: 1,
    pageSize: 5
  }).then((r) => r?.data?.comments || null);
};
