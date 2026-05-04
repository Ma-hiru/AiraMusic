import {
  FC,
  memo,
  MouseEvent as ReactMouseEvent,
  Ref,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import {
  NeteaseAlbum,
  NeteaseHistory,
  NeteaseTrackRecord
} from "@mahiru/ui/public/source/netease/models";
import { cx } from "@emotion/css";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseImageSize, PlaylistSource } from "@mahiru/ui/public/enum";
import { HeartManager } from "@mahiru/ui/public/hooks/useHeart";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import ImageConstants from "@mahiru/ui/windows/main/constants/image";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";

import Top from "./top";
import Divider from "./Divider";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import TrackList, {
  TrackListPlayableManager,
  TrackListRef
} from "@mahiru/ui/public/components/track_list/TrackList";

export type AlbumPageRef = {
  trackListRef: Nullable<TrackListRef>;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  reload: NormalFunc;
};

interface AlbumPageProps {
  ref?: Ref<AlbumPageRef>;
  id: number;
  activeTrackID: Undefinable<number>;
  onClick: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  onContext: Optional<
    NormalFunc<
      [
        e: ReactMouseEvent<HTMLDivElement, MouseEvent>,
        track: NeteaseTrackRecord | NeteaseHistory,
        index: number
      ]
    >
  >;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  onRangeUpdate?: NormalFunc<[range: IndexRange]>;
  className?: string;
  coverSize: NeteaseImageSize;
  onAddList: NormalFunc;
  onPlayAll: NormalFunc;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
}

const Album: FC<AlbumPageProps> = ({
  ref,
  id,
  activeTrackID,
  onClick,
  onContext,
  onClickArtist,
  onClickAlbum,
  onRangeUpdate,
  className,
  coverSize,
  onAddList,
  onPlayAll,
  heartManager,
  playableManager
}) => {
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [album, setAlbum] = useState<Nullable<NeteaseAlbum>>(null);
  const [dynamic, setDynamic] =
    useState<Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>>(null);

  const update = useUpdate();
  const reload = useCallback(() => {
    setStatus("loading");
    setAlbum(null);
    setDynamic(null);
    update();
  }, [update]);

  useEffect(() => {
    if (!id) return;
    let cancel = false;

    const tasks = [NeteaseServices.Album.id(id), NeteaseServices.Album.dynamic(id)] as const;
    setStatus("loading");
    Promise.all(tasks)
      .then(([album, dynamic]) => {
        if (cancel) return;
        startTransition(() => {
          setAlbum(album);
          setDynamic(dynamic);
          setStatus("success");
        });
      })
      .catch((err) => {
        if (cancel) return;
        Log.error(err);
        startTransition(() => {
          setStatus("error");
        });
      });

    return () => {
      cancel = true;
    };
  }, [
    id,
    // reload
    update.count
  ]);

  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  useImperativeHandle(
    ref,
    () => ({
      trackListRef: trackListRef.current,
      album,
      dynamic,
      reload
    }),
    [album, dynamic, reload]
  );

  return (
    <div className={cx("w-full h-full", className)}>
      <AppErrorBoundary name="AlbumPage" canReset className="w-full h-full" toast onReset={reload}>
        <ThrowIf when={status === "error"} message="加载专辑失败" />
        <AppLoading loading={status === "loading"}>
          <Top
            coverSize={coverSize}
            album={album}
            dynamic={dynamic}
            onAddList={onAddList}
            onPlayAll={onPlayAll}
          />
          <Divider />
          {album && (
            <TrackList
              heartManager={heartManager}
              playableManager={playableManager}
              ref={trackListRef}
              tracks={album.tracks}
              id={album.content.id}
              type={PlaylistSource.Album}
              activeID={activeTrackID}
              onClick={onClick}
              onContext={onContext}
              onRangeUpdate={onRangeUpdate}
              onClickAlbum={onClickAlbum}
              onClickArtist={onClickArtist}
              trackCoverSize={ImageConstants.PlaylistPageTrackCoverSize}
            />
          )}
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Album);
