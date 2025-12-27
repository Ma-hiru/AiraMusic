import { FC, useRef } from "react";
import { useParams } from "react-router-dom";
import { usePlaylistNormalRender } from "@mahiru/ui/hook/usePlaylistRender";

import Top from "./top";
import Divider from "./Divider";
import TrackList, { TrackListRef } from "@mahiru/ui/componets/track_list";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";

const PlaylistPage: FC<object> = () => {
  const { stage } = useStage();
  const { id } = useParams();
  const listRef = useRef<TrackListRef>(null);
  const props = usePlaylistNormalRender(listRef, id);

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
        {stage >= Stage.Finally && <TrackList ref={listRef} {...props} />}
      </div>
    </div>
  );
};
export default PlaylistPage;
