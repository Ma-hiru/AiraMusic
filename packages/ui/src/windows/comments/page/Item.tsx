import { FC, memo, useCallback, useState } from "react";
import { NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import { CommentType, NeteaseImageSize } from "@mahiru/ui/public/enum";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { ThumbsUp } from "lucide-react";
import { NeteaseAPIComment } from "@mahiru/ui/public/source/netease/api";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { FormatNumber } from "@mahiru/ui/public/utils/format";
import { cx } from "@emotion/css";
import AppToast from "@mahiru/ui/public/components/toast";
import { Log } from "@mahiru/ui/public/utils/dev";

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
      })
        .then(() => {
          AppToast.show({
            type: "success",
            text: props.like ? "点赞成功" : "取消点赞成功"
          });
        })
        .catch((err) => {
          Log.error(err);
          AppToast.show({
            type: "error",
            text: "点赞失败"
          });
          setLiked(!props.like);
        });
    },
    [sourceID, type]
  );
  return (
    <>
      <div className="border-b border-(--theme-color-main)/10 m-2" />
      <div
        key={data.commentId}
        className="text-sm font-medium flex flex-row items-start justify-start gap-2">
        <NeteaseImage
          cache
          cacheLazy
          className="size-8 rounded-full shrink-0"
          image={NeteaseNetworkImage.fromURL(data.user.avatarUrl)
            ?.setSize(NeteaseImageSize.sm)
            .setAlt(data.user.nickname)}
        />
        <div className="space-y-1 w-full">
          <h1 className="font-semibold text-xs flex flex-col items-start justify-start">
            <span className="text-(--theme-color-main)">{data.user.nickname}</span>
            <span className="text-(--theme-color-main)/60 text-xs text-[10px] opacity-80">
              {data.ipLocation.location} {FormatNumber.time(data.time)}
            </span>
          </h1>
          <p className="text-xs text-(--theme-color-main)/90">{data.content}</p>
          <div
            style={{ color: data.liked ? mainColor.string() : undefined }}
            className="text-xs opacity-80 font-medium flex flex-row items-center justify-end gap-1 px-1 py-0.5 rounded-md cursor-pointer">
            <ThumbsUp
              className={cx(
                "size-3 inline-block",
                liked ? "text-red-500" : "text-(--theme-color-main)"
              )}
              fill={liked ? "#fb2c36" : "transparent"}
              onClick={() =>
                like({
                  commentID: data.commentId,
                  like: !liked
                })
              }
            />
            <span
              className={cx("leading-3", liked ? "text-red-500" : "text-(--theme-color-main)")}
              onClick={() =>
                like({
                  commentID: data.commentId,
                  like: !liked
                })
              }>
              {FormatNumber.count(data.likedCount)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(Item);
