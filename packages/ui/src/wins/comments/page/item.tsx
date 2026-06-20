import { type FC, memo, useCallback, useState } from "react";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { CommentType, NeteaseImageSize } from "@/common/enum";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { ThumbsUp } from "lucide-react";
import { NeteaseAPIComment } from "@/common/netease/api";
import { RendererFormat } from "@/common/lib/format";
import { cx } from "@emotion/css";
import { Log } from "@/common/lib/log";
import AppToast from "@/common/components/display/toast";

import NeteaseImage from "@/common/components/display/image/netease-image";

interface ItemProps {
  data: NeteaseAPI.NeteaseComment;
  sourceID?: number;
  type?: "album" | "playlist" | "track";
}

const Item: FC<ItemProps> = ({ data, sourceID, type }) => {
  const { mainColor } = useThemeColor();
  const [liked, setLiked] = useState(data.liked);
  const like = useCallback(
    async (props: { commentID: number; like: boolean }) => {
      if (!sourceID || !type) return;
      let commentType;
      switch (type) {
        case "track":
          commentType = CommentType.Song;
          break;
        case "album":
          commentType = CommentType.Album;
          break;
        case "playlist":
          commentType = CommentType.Playlist;
          break;
      }
      if (commentType == null) return;
      setLiked(props.like);
      NeteaseAPIComment.like({
        cid: props.commentID,
        id: sourceID,
        t: props.like ? 1 : 0,
        type: commentType
      }).catch((err) => {
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "操作失败"
        });
        setLiked(!props.like);
      });
    },
    [sourceID, type]
  );
  return (
    <>
      <div className="border-b border-white/30 m-2" />
      <div
        key={data.commentId}
        className="text-sm font-medium flex flex-row items-start justify-start gap-2">
        <NeteaseImage
          cache
          cacheLazy
          className="size-8 rounded-full shrink-0 border"
          shadow="base"
          image={NeteaseNetworkImage.fromURL(data.user.avatarUrl)
            ?.setSize(NeteaseImageSize.sm)
            .setAlt(data.user.nickname)}
        />
        <div className="space-y-1 w-full">
          <h1 className="font-semibold text-xs flex flex-col items-start justify-start">
            <span>{data.user.nickname}</span>
            <span className="opacity-50 text-xs text-[10px]">
              {data.ipLocation?.location} {RendererFormat.time(data.time)}
            </span>
          </h1>
          <p className="text-xs p-1 rounded-lg rounded-tl-none">{data.content}</p>
          <div
            style={{ color: data.liked ? mainColor.string() : undefined }}
            className="text-xs opacity-80 font-medium flex flex-row items-center justify-end gap-1 px-1 py-0.5 rounded-md cursor-pointer">
            <ThumbsUp
              className={cx("size-3 inline-block", liked && "text-(--theme-color-main)")}
              fill={liked ? "currentColor" : "transparent"}
              onClick={() =>
                like({
                  commentID: data.commentId,
                  like: !liked
                })
              }
            />
            <span
              className={cx("leading-3", liked && "text-(--theme-color-main)")}
              onClick={() =>
                like({
                  commentID: data.commentId,
                  like: !liked
                })
              }>
              {RendererFormat.count(data.likedCount)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(Item);
