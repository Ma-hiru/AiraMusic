import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useMemo, useState } from "react";
import { Music2, UserRound } from "lucide-react";
import { NeteaseAPIArtist, NeteaseAPITrack } from "@/common/netease/api";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { type ArtistArea, RendererHomeConstants, type SongArea } from "@/wins/main/constants";
import { NeteaseTrackRecord } from "@/common/netease/models";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppToast from "@/common/components/display/toast";
import RendererImageConstants from "@/common/constants/image";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import MediaGrid from "@/common/components/layout/media-grid";
import Section from "@/common/components/layout/section";

const HomeSongsArtistsView: FC<{ className?: string }> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const { jumpArtistPage } = usePageJump();
  const [songArea, setSongArea] = useState<SongArea>(RendererHomeConstants.HOME_SONG_AREAS[0]);
  const [artistArea, setArtistArea] = useState<ArtistArea>(
    RendererHomeConstants.HOME_ARTIST_AREAS[0]
  );

  // 获取歌曲
  const {
    status: songStatus,
    data: songs = [],
    fetchData: fetchSongs
  } = useRequestStatusWrap(
    useCallback((type: SongArea["type"]) => {
      return NeteaseAPITrack.recommendNew(type).then((response) => response.data.slice(0, 40));
    }, [])
  );
  const { reload: reloadSongs } = useRequestAutoRun(fetchSongs, [songArea.type]);

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

  // 获取歌手
  const {
    status: artistStatus,
    data: artists = [],
    fetchData: fetchArtists
  } = useRequestStatusWrap(
    useCallback((type: ArtistArea["type"]) => {
      return NeteaseAPIArtist.toplist(type).then((response) => response.list.artists.slice(0, 30));
    }, [])
  );
  const { reload: reloadArtists } = useRequestAutoRun(fetchArtists, [artistArea.type]);

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

  // 播放歌曲
  const playSong = useCallback(
    async (id: number) => {
      try {
        const track = await NeteaseServicesTrack.idEnsure(id);
        const record = new NeteaseTrackRecord({
          detail: track,
          sourceID: -1,
          sourceName: "other"
        });
        player.playlist.add(record, "next");
        player.playlist.jump(record);
      } catch {
        AppToast.show({ type: "error", text: "播放歌曲失败" });
      }
    },
    [player.playlist]
  );

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <Section title="新歌速递" subTitle="New Songs" Icon={Music2}>
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {RendererHomeConstants.HOME_SONG_AREAS.map((area) => (
            <button
              key={area.type}
              onClick={() => setSongArea(area)}
              className={cx(
                `
                  h-8 cursor-pointer rounded-lg
                  border border-white/20 px-3 text-sm font-bold
                  transition-all duration-300
                  hover:bg-primary hover:text-(--text-color-on-main)
                  active:scale-[0.98]
                `,
                area.type === songArea.type
                  ? "bg-primary text-(--text-color-on-main)"
                  : "bg-white/5"
              )}>
              {area.label}
            </button>
          ))}
        </div>
        <AppError reset={reloadSongs} when={songStatus === "error"} message="加载新歌失败">
          <AppLoading loading={songStatus === "loading"} className="min-h-60">
            <MediaGrid
              items={songItems}
              coverSize={RendererImageConstants.AlbumListCoverSize}
              onClickItem={playSong}
            />
          </AppLoading>
        </AppError>
      </Section>
      <Section title="歌手推荐" subTitle="Artist Chart" Icon={UserRound}>
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {RendererHomeConstants.HOME_ARTIST_AREAS.map((area) => (
            <button
              key={area.label}
              type="button"
              onClick={() => setArtistArea(area)}
              className={cx(
                `
                  h-8 cursor-pointer rounded-lg
                  border border-white/20 px-3 text-sm font-bold
                  transition-all duration-300
                  hover:bg-primary hover:text-(--text-color-on-main)
                  active:scale-[0.98]
                `,
                area.type === artistArea.type
                  ? "bg-primary text-(--text-color-on-main)"
                  : "bg-white/5"
              )}>
              {area.label}
            </button>
          ))}
        </div>
        <AppError reset={reloadArtists} when={artistStatus === "error"} message="加载歌手榜失败">
          <AppLoading loading={artistStatus === "loading"} className="min-h-60">
            <MediaGrid
              items={artistItems}
              coverSize={RendererImageConstants.AlbumListCoverSize}
              onClickItem={jumpArtistPage}
            />
          </AppLoading>
        </AppError>
      </Section>
    </div>
  );
};

export default memo(HomeSongsArtistsView);
