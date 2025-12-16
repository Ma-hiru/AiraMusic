import { FC, memo, useCallback, useEffect, useState } from "react";
import { CommentType } from "@mahiru/ui/api/comment";
import { API } from "@mahiru/ui/api";
import { Time } from "@mahiru/ui/utils/time";
import Color from "color";

interface MetaWikiProps {
  infoSync: InfoSync<"comments">;
  themeSync: InfoSync<"theme">;
}

const MetaWiki: FC<MetaWikiProps> = ({ infoSync, themeSync }) => {
  const [RenderData, setRenderData] = useState<string[]>([]);
  const RenderSongWiki = useCallback((wiki: Nullable<NeteaseUGCSongData>) => {
    setRenderData([
      ...(wiki?.language?.split(",") || []),
      (wiki?.mvIds?.length !== 0 && "mv") || "",
      Time.formatTrackDate(wiki?.publishTime)
    ]);
  }, []);
  const RenderAlbumWiki = useCallback((wiki: Undefinable<NeteaseUGCAlbumData>) => {
    setRenderData([
      ...(wiki?.language?.split(",") || []),
      wiki?.company || "",
      Time.formatTrackDate(wiki?.publishTime),
      wiki?.type || "",
      ...(wiki?.songTags || []).map((tag) => tag.name || "")
    ]);
  }, []);
  useEffect(() => {
    if (infoSync.value.type === CommentType.Song) {
      API.Wiki.getUGCSong(infoSync.value.id).then((response) => {
        RenderSongWiki(response.data);
      });
    } else if (infoSync.value.type === CommentType.Album) {
      API.Wiki.getUGCAlbum(infoSync.value.id).then((response) => {
        RenderAlbumWiki(response.data);
      });
    } else if (infoSync.value.type === CommentType.Playlist) {
      // todo
    }
  }, [RenderAlbumWiki, RenderSongWiki, infoSync.value]);
  return (
    <div
      className="flex justify-center items-center gap-1"
      style={{ color: Color(themeSync.value.secondaryColor).darken(0.5).string() }}>
      {RenderData.map((data) => {
        if (!data) return null;
        return (
          <p
            key={data}
            className="text-[10px] font-semibold px-1  rounded-sm bg-white/20 backdrop-blur-md">
            {data}
          </p>
        );
      })}
    </div>
  );
};
export default memo(MetaWiki);
