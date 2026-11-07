import { cx } from "@emotion/css";
import { UserRound } from "lucide-react";
import { memo, type FC, useMemo, useState, useEffect } from "react";
import { Log } from "@/common/lib/log";
import { NeteaseImageSize } from "@/common/enum";
import { useUpdate } from "@/common/hooks/use-update";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { NeteaseNetworkImage } from "@/common/netease/models";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import NeteaseImage from "@/common/components/display/image/netease-image";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import type { RequestStatus } from "@/common/hooks/use-request-wrap";

interface SimilarArtistsProps {
  id: number;
  className?: string;
  onClick: NormalFunc<[id: number]>;
}

interface SimilarArtistsState {
  id: number;
  status: RequestStatus;
  artists: NeteaseAPI.NeteaseSimilarArtist[];
}

const noop = () => {};

const SimilarArtists: FC<SimilarArtistsProps> = ({ id, className, onClick }) => {
  const update = useUpdate();
  const [state, setState] = useState<SimilarArtistsState>({
    id,
    status: id > 0 ? "loading" : "success",
    artists: []
  });

  useEffect(() => {
    if (id <= 0) {
      setState({ id, status: "success", artists: [] });
      return;
    }
    const controller = new AbortController();
    setState({ id, status: "loading", artists: [] });

    NeteaseAPIArtist.similar(id, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.code !== 200) throw new Error(response.message || "相似歌手加载失败");
        const seen = new Set([id]);
        const artists: NeteaseAPI.NeteaseSimilarArtist[] = [];
        for (const artist of response.artists ?? []) {
          if (!Number.isSafeInteger(artist.id) || artist.id <= 0 || seen.has(artist.id)) continue;
          seen.add(artist.id);
          artists.push(artist);
        }
        setState({ id, status: "success", artists });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        Log.error(err);
        setState({ id, status: "error", artists: [] });
      });

    return () => controller.abort();
  }, [id, update.count]);

  const current = state.id === id;
  const status = current ? state.status : "loading";
  const artists = current ? state.artists : [];

  if (status === "loading") {
    return <AppLoading className={cx("h-full", className)} tips="正在加载相似歌手" loading />;
  }
  if (status === "error") {
    return (
      <AppError
        className={cx("h-full", className)}
        reset={update}
        tips="相似歌手加载失败，点击重试"
        when
      />
    );
  }
  if (artists.length === 0) {
    return <AppEmpty className={cx("h-full", className)} tips="暂无相似歌手" />;
  }

  return (
    <InfiniteContainer
      className={cx("h-full pr-2 [scrollbar-gutter:stable]", className)}
      hasMore={false}
      isLoading={false}
      onLoadMore={noop}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 pb-3">
        {artists.map((artist) => (
          <ArtistCard key={artist.id} artist={artist} onClick={onClick} />
        ))}
      </div>
    </InfiniteContainer>
  );
};

export default memo(SimilarArtists);

const ArtistCard: FC<{
  onClick: NormalFunc<[id: number]>;
  artist: NeteaseAPI.NeteaseSimilarArtist;
}> = ({ onClick, artist }) => {
  const avatar = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(artist.img1v1Url || artist.picUrl)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(artist.name),
    [artist.img1v1Url, artist.name, artist.picUrl]
  );
  const alias = useMemo(
    () =>
      [
        ...new Set(
          [...(artist.transNames ?? []), artist.trans, ...(artist.alias ?? [])]
            .map((name) => name?.trim())
            .filter((name) => name && name !== artist.name)
        )
      ].join(" / "),
    [artist]
  );

  return (
    <button
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors duration-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      type="button"
      onClick={() => onClick(artist.id)}>
      <NeteaseImage
        className="size-14 shrink-0 rounded-full"
        shadow="none"
        image={avatar}
        fallback={<UserRound className="size-6 opacity-35" aria-hidden="true" />}
        cache
      />
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold" title={artist.name}>
          {artist.name}
        </span>
        {alias && (
          <span className="mt-0.5 block truncate text-[10px] opacity-60" title={alias}>
            {alias}
          </span>
        )}
        {typeof artist.musicSize === "number" && (
          <span className="mt-1 block text-[10px] opacity-55">{artist.musicSize} 首作品</span>
        )}
      </span>
    </button>
  );
};
