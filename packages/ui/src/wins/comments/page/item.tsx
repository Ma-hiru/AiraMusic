import { cx } from "@emotion/css";
import { ThumbsUp } from "lucide-react";
import { memo, type FC, useState, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIComment } from "@/common/netease/api";
import { CommentType, NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import AppToast from "@/common/components/display/toast";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface ItemProps {
  small?: boolean;
  avatar?: boolean;
  border?: boolean;
  reverse?: boolean;
  sourceID?: number;
  data: NeteaseAPI.NeteaseComment;
  type?: "album" | "track" | "playlist";
}

const Item: FC<ItemProps> = ({
  data,
  type,
  sourceID,
  avatar = true,
  border = true,
  small = false,
  reverse = false
}) => {
  const { mainColor } = useThemeColor();
  const [liked, setLiked] = useState(data.liked);
  const like = useCallback(
    async (props: { like: boolean; commentID: number }) => {
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
      {border && <div className="border-b border-white/30 m-2" />}
      <div
        key={data.commentId}
        className={cx(
          "text-sm font-medium flex flex-row items-start justify-start gap-2",
          reverse && "flex-row-reverse",
          !avatar && "block"
        )}>
        {avatar && (
          <NeteaseImage
            className={cx(
              `
            size-8 rounded-full shrink-0 border cursor-pointer
            ease-in-out duration-300 transition-opacity hover:opacity-50
           `,
              small && "size-6!"
            )}
            shadow="base"
            image={NeteaseNetworkImage.fromURL(data.user.avatarUrl)
              ?.setSize(NeteaseImageSize.sm)
              .setAlt(data.user.nickname)}
            cache
            preview
            cacheLazy
          />
        )}
        <div className={cx("space-y-1 w-full flex flex-col", reverse && "flex-col-reverse")}>
          <h1
            className={cx(
              "font-semibold text-xs flex flex-col items-start justify-start",
              small && "text-[10px]!",
              reverse && "text-right! items-end!"
            )}>
            <span>{data.user.nickname}</span>
            <span className={cx("opacity-50 text-xs text-[10px]", small && "text-[8px]!")}>
              {data.ipLocation?.location} {RendererFormat.time(data.time)}
            </span>
          </h1>
          <p
            className={cx(
              "text-xs select-text p-1 rounded-lg rounded-tl-none",
              small && "text-[10.5px]!"
            )}>
            {!avatar && <span>『</span>} {data.content} {!avatar && <span>』</span>}
          </p>
          <div
            className={cx(
              "text-xs opacity-80 font-medium flex flex-row items-center justify-end gap-1 px-1 py-0.5 rounded-md cursor-pointer",
              small && "text-[10.5px]!",
              !avatar && "hidden"
            )}
            style={{ color: data.liked ? mainColor.string() : undefined }}>
            <ThumbsUp
              className={cx("size-3 inline-block", liked && "text-primary")}
              fill={liked ? "currentColor" : "transparent"}
              onClick={() =>
                like({
                  commentID: data.commentId,
                  like: !liked
                })
              }
            />
            <span
              className={cx("leading-3", liked && "text-primary")}
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
