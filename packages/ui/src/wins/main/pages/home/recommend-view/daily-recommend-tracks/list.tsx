import { type FC, memo, type RefObject } from "react";
import { NeteaseTrack, NeteaseTrackRecord } from "@/common/netease/models";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import RendererImageConstants from "@/common/constants/image";

import HomeMediaCard from "@/common/components/layout/media-grid/card";

interface RecommendTrackListProps {
  recommend: NeteaseAPI.DailyRecommendTracksDailySong[];
  containerRef: RefObject<Nullable<HTMLDivElement>>;
}

const RecommendTrackList: FC<RecommendTrackListProps> = ({ recommend, containerRef }) => {
  return (
    <div
      ref={containerRef}
      className="
         relative w-full my-2 overflow-y-hidden
         overflow-x-scroll scrollbar-hide scroll-smooth contain-layout
         grid grid-cols-[repeat(auto_fill,minmax(150px,1fr))]
         grid-flow-col snap-x snap-mandatory auto-cols-[minmax(150px,1fr)]
         items-start gap-1
      ">
      {recommend.map((song) => (
        <div key={song.id} className="snap-start">
          <HomeMediaCard
            className="size-full object-center aspect-square"
            item={{
              id: song.id,
              shape: "square",
              name: song.name,
              nameClampLine: 1,
              coverUrl: song.al.picUrl,
              meta: song.ar.map((a) => a.name).join("/") ?? undefined,
              badge: song.reason ?? undefined
            }}
            onClick={() => {
              if (RendererPlayerHandle.player.current.track?.id === song.id) return;
              const track = new NeteaseTrackRecord({
                sourceName: "other",
                sourceID: 0,
                detail: NeteaseTrack.fromObject(song)
              });
              RendererPlayerHandle.player.playlist.add(track, "next");
              RendererPlayerHandle.player.playlist.jump(track);
            }}
            coverSize={RendererImageConstants.HomePageTrackCoverSize}
          />
        </div>
      ))}
    </div>
  );
};

export default memo(RecommendTrackList);
