import { FC, memo, useEffect, useState } from "react";
import Color from "color";
import { NeteaseImageSize } from "@mahiru/ui/utils/image";
import { CommentType } from "@mahiru/ui/api/comment";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

interface MetaSourceProps {
  themeSync: ThemeSync;
  infoSync: InfoSync<"comments">;
}

const MetaSource: FC<MetaSourceProps> = ({ infoSync, themeSync }) => {
  const [RenderData, setRenderData] = useState({
    sourceCover: undefined as Undefinable<string>,
    sourceName: undefined as Undefinable<string>,
    sourceSubtitle: undefined as Undefinable<string>
  });
  useEffect(() => {
    if (infoSync.value.type === CommentType.Song) {
      setRenderData({
        sourceCover: infoSync.value.track.al.picUrl,
        sourceName: infoSync.value.track.name,
        sourceSubtitle: infoSync.value.track.ar.map((a) => a.name).join("/")
      });
    } else if (infoSync.value.type === CommentType.Playlist) {
      setRenderData({
        sourceCover: infoSync.value.playlist.coverImgUrl,
        sourceName: infoSync.value.playlist.name,
        sourceSubtitle: "by " + infoSync.value.playlist.creator.nickname
      });
    }
  }, [infoSync.value]);

  return (
    <div
      className="flex justify-center items-center select-none mb-2 gap-2"
      style={{ color: Color(themeSync?.secondaryColor).darken(0.5).string() }}>
      <NeteaseImage
        className="size-7 rounded-full sm:size-8"
        src={RenderData.sourceCover}
        size={NeteaseImageSize.sm}
        alt={RenderData.sourceName}
      />
      <span className="flex flex-col justify-center items-start">
        <p className="font-semibold text-[10px] sm:text-[14px]">{RenderData.sourceName}</p>
        <p className="font-semibold text-[8px] opacity-50 sm:text-[10px]">
          {RenderData.sourceSubtitle}
        </p>
      </span>
    </div>
  );
};
export default memo(MetaSource);
