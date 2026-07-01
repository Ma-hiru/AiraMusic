import { cx } from "@emotion/css";
import { Music2, UserRound } from "lucide-react";
import { memo, type FC, useMemo, useState, useCallback } from "react";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { NeteaseAPITrack, NeteaseAPIArtist } from "@/common/netease/api";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { type SongArea, type ArtistArea, RendererHomeConstants } from "@/wins/main/constants";
import AppToast from "@/common/components/display/toast";
import Section from "@/common/components/layout/section";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";

const HomeSongsArtistsView: FC<{ className?: string }> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const { jumpArtistPage } = usePageJump();
  const [songArea, setSongArea] = useState<SongArea>(RendererHomeConstants.HOME_SONG_AREAS[0]);
  const [artistArea, setArtistArea] = useState<ArtistArea>(
    RendererHomeConstants.HOME_ARTIST_AREAS[0]
  );

  // 获取歌曲
  const {
    data: songs = [],
    status: songStatus,
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
    data: artists = [],
    status: artistStatus,
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
      <Section title="新歌速递" Icon={Music2} subTitle="New Songs">
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {RendererHomeConstants.HOME_SONG_AREAS.map((area) => (
            <button
              key={area.type}
              className={cx(
                `
                  h-8 cursor-pointer rounded-lg
                  border border-white/20 px-3 text-sm font-bold
                  transition-all duration-300
                  active:scale-[0.98]
                `,
                area.type === songArea.type
                  ? "bg-primary text-primary-text hover:bg-primary-active"
                  : "bg-white/5 hover:bg-white/20"
              )}
              onClick={() => setSongArea(area)}>
              {area.label}
            </button>
          ))}
        </div>
        <AppError message="加载新歌失败" reset={reloadSongs} when={songStatus === "error"}>
          <AppLoading className="min-h-60" loading={songStatus === "loading"}>
            <MediaGrid
              items={songItems}
              coverSize={RendererImageConstants.AlbumListCoverSize}
              onClickItem={playSong}
            />
          </AppLoading>
        </AppError>
      </Section>
      <Section title="歌手推荐" Icon={UserRound} subTitle="Artist Chart">
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {RendererHomeConstants.HOME_ARTIST_AREAS.map((area) => (
            <button
              key={area.label}
              className={cx(
                `
                  h-8 cursor-pointer rounded-lg
                  border border-white/20 px-3 text-sm font-bold
                  transition-all duration-300
                  active:scale-[0.98]
                `,
                area.type === artistArea.type
                  ? "bg-primary text-primary-text hover:bg-primary-active"
                  : "bg-white/5 hover:bg-white/20"
              )}
              type="button"
              onClick={() => setArtistArea(area)}>
              {area.label}
            </button>
          ))}
        </div>
        <AppError message="加载歌手榜失败" reset={reloadArtists} when={artistStatus === "error"}>
          <AppLoading className="min-h-60" loading={artistStatus === "loading"}>
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
