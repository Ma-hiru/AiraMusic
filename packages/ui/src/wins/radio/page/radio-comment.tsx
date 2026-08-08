import { cx } from "@emotion/css";
import { memo, type FC, useMemo, type Ref, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { CommentSort, CommentType } from "@/common/enum";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPIComment } from "@/common/netease/api";
import { useListenable } from "@/common/hooks/use-listenable";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Item from "@/wins/comments/page/item";
import NoDrag from "@/common/components/layout/drag/no-drag";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";

const edgeFadeMask =
  "linear-gradient(to bottom, transparent 0, #000 min(12%, 56px), #000 calc(100% - min(12%, 56px)), transparent 100%)";

interface RadioCommentProps {
  ref?: Ref<HTMLDivElement>;
  className?: string;
}

const RadioComment: FC<RadioCommentProps> = ({ ref, className }) => {
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

  return (
    <NoDrag
      ref={ref}
      className={cx("flex flex-col justify-between items-center gap-2 cursor-pointer", className)}>
      <AppError
        className="text-[10px] font-semibold"
        reset={reload}
        when={status === "error"}
        asChild
        smallIcon>
        <AppLoading
          className="text-[10px] font-semibold"
          tips="正在加载评论"
          loading={status === "loading"}
          smallIcon>
          <section
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar scrollbar-hide px-1 pr-3 py-3.5"
            style={{
              maskImage: edgeFadeMask,
              WebkitMaskImage: edgeFadeMask
            }}>
            {data?.map((i, idx) => (
              <Item key={i.commentId} data={i} avatar={false} border={idx > 0} small reverse />
            ))}
            {empty}
          </section>
        </AppLoading>
      </AppError>
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
    pageSize: 5,
    cache: true
  }).then((r) => r?.data?.comments || null);
};
