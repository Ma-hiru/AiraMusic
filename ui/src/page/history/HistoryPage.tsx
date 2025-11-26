import { FC, memo, useState } from "react";
import { getTrackDetail } from "@mahiru/ui/api/track";
import { userLikedSongsIDs, userPlaylist } from "@mahiru/ui/api/user";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";

const HistoryPage: FC<object> = () => {
  const [trackId, setTrackId] = useState("");
  const { data } = usePersistZustandShallowStore(["data"]);
  // login => userPlayList limit?
  // => likedSongsIDs
  // playListDetail => trackIDs => trackDetail
  return (
    <div className="flex w-full h-full flex-col justify-center items-center gap-2">
      <div>
        <button
          className="cursor-pointer border bg-purple-500 text-white px-2 py-1 font-semibold rounded-md"
          onClick={() => {
            getTrackDetail(trackId).then(console.log);
          }}>
          getTrackDetail
        </button>
        <input
          type="text"
          className="border"
          value={trackId}
          onChange={(e) => {
            setTrackId(e.target.value.trim());
          }}
        />
      </div>
      <div>
        <button
          className="cursor-pointer border bg-purple-500 text-white px-2 py-1 font-semibold rounded-md"
          onClick={() => {
            userPlaylist({
              uid: data?.user?.userId || 0,
              limit: 100,
              offset: 2
            }).then(console.log);
          }}>
          userPlaylist
        </button>
      </div>
    </div>
  );
};
export default memo(HistoryPage);
