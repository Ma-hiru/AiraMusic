import { cx } from "@emotion/css";
import { GlobeOff } from "lucide-react";
import {
  memo,
  useId,
  useRef,
  type FC,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle
} from "react";
import { SearchTrack } from "@mahiru/wasm";
import { useOnline } from "@/common/hooks/use-online";
import { type HeartManager } from "@/common/hooks/use-heart";
import { NeteaseServicesArtist } from "@/common/netease/services";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { NeteaseArtist, NeteaseTrackRecord } from "@/common/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppError from "@/common/components/fallback/app-error";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";
import TrackList, {
  type TrackListRef,
  type TrackListClickFunc,
  type TrackListPlayableManager
} from "@/common/components/display/track_list";

import Header from "./header";
import AlbumList from "./album";
import Introduction from "./introduction";
import SimilarArtists from "./similar-artists";
import ContentTabs, { type ArtistTab } from "./content-tabs";

export type ArtistRef = {
  reload: NormalFunc;
  artist: Nullable<NeteaseArtist>;
  trackListRef: Nullable<TrackListRef>;
};

interface ArtistProps {
  ref?: Ref<ArtistRef>;
  id: number;
  className?: string;
  routerActive: boolean;
  activeTrackID?: number;
  pageActionType: "out" | "none" | "enter";
  heartManager: Optional<HeartManager>;
  playableManager: Optional<TrackListPlayableManager>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  setIsTyping?: NormalFunc<[typing: boolean]>;
  onAddList?: NormalFunc;
  onReplace?: NormalFunc;
  onPageAction: NormalFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
  onClick: TrackListClickFunc<NeteaseTrackRecord>;
  onDataLoaded?: NormalFunc<[artist: NeteaseArtist]>;
  onLoadedData?: NormalFunc<[artist: NeteaseArtist]>;
}

const Artist: FC<ArtistProps> = ({
  ref,
  id,
  className,
  activeTrackID,
  pageActionType,
  heartManager,
  playableManager,
  addToPlaylistLast,
  addToPlaylistNext,
  addTrackToPlaylist,
  openComment,
  setIsTyping,
  onClick,
  onAddList,
  onReplace,
  onClickAlbum,
  onDataLoaded,
  onLoadedData,
  onPageAction,
  onClickArtist,
  onAvatarLoaded,
  routerActive
}) => {
  const requestData = useCallback((id: number) => {
    if (id <= 0 || !id) return Promise.resolve(null);
    return NeteaseServicesArtist.id(id);
  }, []);
  const { status, fetchData, data: artist = null } = useRequestStatusWrap(requestData);
  const { reload } = useRequestAutoRun(fetchData, [id]);

  useEffect(() => {
    if (artist) onLoadedData?.(artist);
  }, [artist, onLoadedData]);

  const tabsID = useId();
  const [activeTab, setActiveTab] = useState<ArtistTab>("tracks");
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState<{ query: string; tab: ArtistTab }>({
    tab: "tracks",
    query: ""
  });
  const query = search.tab === activeTab ? search.query.trim() : "";
  const searcher = useRef<Nullable<SearchTrack>>(null);
  const [results, setResults] = useState<{
    query: string;
    tracks: NeteaseTrackRecord[];
    artist: Nullable<NeteaseArtist>;
  }>({ artist: null, query: "", tracks: [] });

  useEffect(() => {
    const index = new SearchTrack();
    index.update(JSON.stringify(artist?.hotTracks.map((track) => track.detail) ?? []));
    searcher.current = index;
    return () => {
      if (searcher.current === index) searcher.current = null;
      index.free();
    };
  }, [artist]);
  useEffect(() => {
    const allTracks = artist?.hotTracks ?? [];
    const tracks =
      query && activeTab === "tracks" && searcher.current
        ? Array.from(searcher.current.search(query), (index) => allTracks[index]!)
        : allTracks;
    setResults({ artist, query, tracks });
  }, [activeTab, artist, query]);
  const tracks = useMemo(() => {
    if (activeTab !== "tracks" || !query) return artist?.hotTracks ?? [];
    return results.artist === artist && results.query === query ? results.tracks : [];
  }, [activeTab, artist, query, results]);

  const changeTab = useCallback((tab: ArtistTab) => {
    setActiveTab(tab);
    setKeyword("");
    setSearch({ tab, query: "" });
  }, []);
  const searchContent = useCallback(
    (query: string) => setSearch({ tab: activeTab, query }),
    [activeTab]
  );
  useEffect(() => changeTab("tracks"), [changeTab, id]);
  useEffect(() => () => setIsTyping?.(false), [setIsTyping]);

  const playAll = useCallback(() => {
    if (!artist?.hotTracks.length) return;
    if (onReplace) onReplace();
    else onClick(artist.hotTracks[0]!, 0);
  }, [artist, onClick, onReplace]);

  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  useImperativeHandle(
    ref,
    () => ({
      reload,
      artist,
      trackListRef: trackListRef.current
    }),
    [artist, reload]
  );

  const [albumListMounted, setAlbumListMounted] = useState(false);
  const [similarMounted, setSimilarMounted] = useState(false);
  useEffect(() => {
    if (activeTab === "albums") setAlbumListMounted(true);
    if (activeTab === "similar") setSimilarMounted(true);
  }, [activeTab]);

  // 右键菜单
  const { onContextMenu } = useTrackContextMenu({
    addToPlaylistLast,
    addToPlaylistNext,
    onClickAlbum,
    onClickArtist,
    onPlay: onClick,
    openComment,
    addTrackToPlaylist
  });

  useEffect(() => {
    artist && onDataLoaded?.(artist);
  }, [artist, onDataLoaded]);

  useAgentFocusCtx(
    { page: "artist", id, name: artist?.id === id ? artist.name : "" },
    routerActive
  );

  const { online } = useOnline();
  return (
    <div className={cx("flex h-full min-h-0 w-full flex-col overflow-hidden", className)}>
      <AppError
        reset={reload}
        when={status === "error"}
        tipsIcon={!online ? GlobeOff : undefined}
        tips={!online ? "网络连接中断，请检查网络后重试" : undefined}>
        <AppLoading loading={status === "loading"}>
          <Header
            artist={artist}
            reload={reload}
            pageActionType={pageActionType}
            showIntro={activeTab === "intro"}
            onPlayAll={playAll}
            onAddList={onAddList}
            onPageAction={onPageAction}
            onAvatarLoaded={onAvatarLoaded}
            onShowIntro={() => changeTab("intro")}>
            <ContentTabs
              id={tabsID}
              keyword={keyword}
              active={activeTab}
              setIsTyping={setIsTyping}
              trackCount={artist?.hotTracks.length ?? 0}
              albumCount={artist?.detail.artist.albumSize ?? 0}
              onChange={changeTab}
              onSearch={searchContent}
              onKeywordChange={setKeyword}
            />
            <div className="relative min-h-0 w-full flex-1">
              {(["tracks", "albums", "intro", "similar"] as const).map((tab) => (
                <section
                  key={tab}
                  id={`${tabsID}-${tab}-panel`}
                  className={cx(
                    "absolute inset-0 pt-1",
                    activeTab !== tab &&
                      (tab === "tracks" ? "invisible pointer-events-none" : "hidden")
                  )}
                  role="tabpanel"
                  inert={activeTab !== tab}
                  aria-hidden={activeTab !== tab}
                  aria-labelledby={`${tabsID}-${tab}-tab`}>
                  {tab === "tracks" && artist && (
                    <TrackList
                      ref={trackListRef}
                      id={id}
                      className="h-full min-h-0"
                      type="normal"
                      tracks={tracks}
                      activeID={activeTrackID}
                      heartManager={heartManager}
                      playableManager={playableManager}
                      trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
                      onClick={onClick}
                      onContext={onContextMenu}
                      onClickAlbum={onClickAlbum}
                      onClickArtist={onClickArtist}
                    />
                  )}
                  {tab === "albums" && albumListMounted && (
                    <AlbumList
                      key={id}
                      id={id}
                      className="h-full min-h-0 pb-4 pt-2"
                      keyword={activeTab === "albums" ? query : ""}
                      onClick={onClickAlbum}
                    />
                  )}
                  {tab === "intro" && <Introduction className="h-full" artist={artist} />}
                  {tab === "similar" && similarMounted && (
                    <SimilarArtists id={id} className="h-full pt-2" onClick={onClickArtist} />
                  )}
                </section>
              ))}
            </div>
          </Header>
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(Artist);
