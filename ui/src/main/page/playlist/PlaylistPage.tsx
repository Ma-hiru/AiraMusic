import { FC, memo } from "react";
import { useParams } from "react-router-dom";
import { usePlaylistNormalRender } from "@mahiru/ui/main/hooks/usePlaylistRender";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { Stage } from "@mahiru/ui/public/enum";

import Top from "./top";
import Divider from "./Divider";
import TrackList from "@mahiru/ui/public/components/track_list";

const PlaylistPage: FC<object> = () => {
  const { stage } = useStage();
  const { id } = useParams();
  const props = usePlaylistNormalRender(id);

  return (
    <div className="w-full h-full px-12 pt-20 contain-style contain-size contain-layout">
      {stage >= Stage.First && (
        <Top
          entry={props.entry}
          onPlayAll={() => {}}
          onAddList={() => {}}
          searchTracks={props.searchTracks}
        />
      )}
      {stage >= Stage.Second && <Divider />}
      <div className="w-full h-[calc(100%-210px)] relative">
        {stage >= Stage.Finally && <TrackList {...props} />}
      </div>
    </div>
  );
};
export default memo(PlaylistPage);
