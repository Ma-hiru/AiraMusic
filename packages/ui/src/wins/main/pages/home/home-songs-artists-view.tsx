import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useMemo, useState } from "react";
import { Music2, UserRound } from "lucide-react";
import { NeteaseAPIArtist, NeteaseAPITrack } from "@/common/netease/api";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { useArtistOrAlbumPageJump } from "@/wins/main/hooks/use-artist-or-album-page-jump";
import { RendererHomeConstants } from "@/wins/main/constants";
import { createHomeTrackRecord } from "./home-track-record";
import AppEntry from "@/wins/main/entry";
import AppToast from "@/common/components/toast";
import RendererImageConstants from "@/common/constants/image";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid from "./home-media-grid";
import HomeSection from "./home-section";

const HomeSongsArtistsView: FC<{ className?: string }> = ({ className }) => {
  const player = AppEntry.usePlayer();
  const { jumpArtistPage } = useArtistOrAlbumPageJump();
  const [songArea, setSongArea] = useState<(typeof RendererHomeConstants.HOME_SONG_AREAS)[number]>(
    RendererHomeConstants.HOME_SONG_AREAS[0]!
  );
  const [artistArea, setArtistArea] = useState<
    (typeof RendererHomeConstants.HOME_ARTIST_AREAS)[number]
  >(RendererHomeConstants.HOME_ARTIST_AREAS[0]!);

  const {
    status: songStatus,
    data: songs = [],
    fetchData: fetchSongs
  } = useRequestStatusWrap(
    useCallback((type: (typeof RendererHomeConstants.HOME_SONG_AREAS)[number]["type"]) => {
      return NeteaseAPITrack.recommendNew(type).then((response) => response.data.slice(0, 40));
    }, [])
  );
  const { reload: reloadSongs } = useRequestAutoRun(fetchSongs, [songArea.type]);

  const {
    status: artistStatus,
    data: artists = [],
    fetchData: fetchArtists
  } = useRequestStatusWrap(
    useCallback((type: (typeof RendererHomeConstants.HOME_ARTIST_AREAS)[number]["type"]) => {
      return NeteaseAPIArtist.toplist(type).then((response) => response.list.artists.slice(0, 30));
    }, [])
  );
  const { reload: reloadArtists } = useRequestAutoRun(fetchArtists, [artistArea.type]);

  const songItems = useMemo(
    () =>
      songs.map((song) => ({
        id: song.id,
        name: song.name,
        coverUrl: song.album.picUrl,
        meta: song.artists.map((artist) => artist.name).join(" / "),
        badge: songArea.label
      })),
    [songArea.label, songs]
  );

  const artistItems = useMemo(
    () =>
      artists.map((artist, index) => ({
        id: artist.id,
        name: artist.name,
        coverUrl: artist.img1v1Url || artist.picUrl,
        meta: artist.trans || artist.transNames?.join(" / ") || `${artist.musicSize} 首单曲`,
        badge: `No.${index + 1}`,
        shape: "circle" as const
      })),
    [artists]
  );

  const playSong = useCallback(
    async (id: number) => {
      try {
        const track = await NeteaseServicesTrack.idEnsure(id);
        const record = createHomeTrackRecord(track);
        player.playlist.add(record, "next");
        player.playlist.jump(record);
      } catch {
        AppToast.show({ type: "error", text: "播放歌曲失败" });
      }
    },
    [player.playlist]
  );

  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <HomeSection title="新歌速递" subTitle="New Songs" Icon={Music2}>
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {RendererHomeConstants.HOME_SONG_AREAS.map((area) => (
            <button
              key={area.type}
              type="button"
              onClick={() => setSongArea(area)}
              className={cx(
                `
                  h-9 cursor-pointer rounded-lg border border-white/20 px-3 text-sm font-bold
                  transition-all duration-300 hover:bg-(--theme-color-main) active:scale-[0.98]
                `,
                area.type === songArea.type ? "bg-(--theme-color-main)" : "bg-white/5"
              )}>
              {area.label}
            </button>
          ))}
        </div>
        <AppError reset={reloadSongs} when={songStatus === "error"} message="加载新歌失败">
          <AppLoading loading={songStatus === "loading"} className="min-h-60">
            <HomeMediaGrid
              items={songItems}
              coverSize={RendererImageConstants.AlbumListCoverSize}
              onClickItem={playSong}
            />
          </AppLoading>
        </AppError>
      </HomeSection>

      <HomeSection title="歌手推荐" subTitle="Artist Chart" Icon={UserRound}>
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {RendererHomeConstants.HOME_ARTIST_AREAS.map((area) => (
            <button
              key={area.label}
              type="button"
              onClick={() => setArtistArea(area)}
              className={cx(
                `
                  h-9 cursor-pointer rounded-lg border border-white/20 px-3 text-sm font-bold
                  transition-all duration-300 hover:bg-(--theme-color-main) active:scale-[0.98]
                `,
                area.type === artistArea.type ? "bg-(--theme-color-main)" : "bg-white/5"
              )}>
              {area.label}
            </button>
          ))}
        </div>
        <AppError reset={reloadArtists} when={artistStatus === "error"} message="加载歌手榜失败">
          <AppLoading loading={artistStatus === "loading"} className="min-h-60">
            <HomeMediaGrid
              items={artistItems}
              coverSize={RendererImageConstants.AlbumListCoverSize}
              onClickItem={jumpArtistPage}
            />
          </AppLoading>
        </AppError>
      </HomeSection>
    </div>
  );
};

export default memo(HomeSongsArtistsView);
