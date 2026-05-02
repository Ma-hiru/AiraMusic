import { FC, memo, useCallback, useState } from "react";
import { NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import { CommentType, NeteaseImageSize } from "@mahiru/ui/public/enum";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { ThumbsUp } from "lucide-react";
import { cx } from "@emotion/css";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { FormatNumber } from "@mahiru/ui/public/utils/format";

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
      if (!commentType) return;
      await NeteaseAPI.Comment.like({
        cid: props.commentID,
        id: sourceID,
        t: props.like ? 1 : 0,
        type: commentType
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
            {liked ? (
              <ThumbsUp
                className="size-3 inline-block text-red-500"
                fill="#fb2c36"
                onClick={async () => {
                  await like({
                    commentID: data.commentId,
                    like: !liked
                  });
                  setLiked(false);
                }}
              />
            ) : (
              <ThumbsUp
                className="size-3 inline-block text-(--theme-color-main)"
                onClick={async () => {
                  await like({
                    commentID: data.commentId,
                    like: !liked
                  });
                  setLiked(true);
                }}
              />
            )}
            <span
              className={cx(
                "leading-3",
                data.liked ? "text-red-500" : "text-(--theme-color-main)"
              )}>
              {FormatNumber.count(data.likedCount)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(Item);
