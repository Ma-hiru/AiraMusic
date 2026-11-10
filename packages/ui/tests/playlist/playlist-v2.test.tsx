import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import Playlist from "@mahiru/ui/common/components/page/playlist-v2";
import type { Ref, ComponentProps } from "react";
import type { PlaylistScope } from "@mahiru/ui/common/types/playlist-scope";
import type { PlaylistRef } from "@mahiru/ui/common/components/page/playlist-v2";

type CollectionItem = { key: string; name: string };

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  preload: vi.fn(),
  navigate: vi.fn(),
  display: vi.fn(),
  displayReady: vi.fn(),
  scrollToItem: vi.fn(),
  mounts: vi.fn(),
  unmounts: vi.fn(),
  similar: vi.fn(),
  similarUnmounts: vi.fn(),
  artistMounts: vi.fn(),
  artistUnmounts: vi.fn(),
  albumMounts: vi.fn(),
  albumUnmounts: vi.fn(),
  artistProps: vi.fn<(props: { query: string; artists: CollectionItem[] }) => void>(),
  albumProps: vi.fn<(props: { query: string; albums: CollectionItem[] }) => void>(),
  isMain: true,
  defaultUseDisplayWindow: false
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: "/playlist", search: "", hash: "" })
}));
vi.mock("@/common/lib/log", () => ({ Log: { error: vi.fn() } }));
vi.mock("@/common/lib/net", () => ({
  RendererNet: { isOnline: true, onOnlineChange: () => () => {} }
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    get isMain() {
      return mocks.isMain;
    },
    display: { reactReadyAwait: mocks.displayReady }
  }
}));
vi.mock("@/common/store/settings", () => ({
  settingsStoreSnapshot: () => ({
    _settings: { preference: { defaultUseDisplayWindow: mocks.defaultUseDisplayWindow } }
  })
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: { display: { deliver: mocks.display }, modified: { twoWay: vi.fn() } }
}));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesPlaylist: { id: mocks.load, preload: mocks.preload }
}));
vi.mock("@/common/netease/api", () => ({ NeteaseAPIPlaylist: { modify: vi.fn() } }));
vi.mock("@/common/netease/models", () => ({
  NeteaseTrackRecord: { fromPlaylist: (p: { tracks: unknown[] }) => p.tracks },
  NeteaseTrack: { toSearchStructString: (tracks: unknown[]) => JSON.stringify(tracks) }
}));
vi.mock("@/common/hooks/use-online", () => ({ useOnline: () => ({ online: true }) }));
vi.mock("@/common/hooks/use-agent-focus-ctx", () => ({ useAgentFocusCtx: vi.fn() }));
vi.mock("@/common/hooks/use-track-context-menu", () => ({
  useTrackContextMenu: () => ({ onContextMenu: vi.fn() })
}));
vi.mock("@/common/hooks/use-track-cover-preload", () => ({
  useTrackCoverPreload: () => ({
    onRangeUpdate: vi.fn(),
    currentVisibleItemIndex: { current: 0 }
  })
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/data-input/search", () => ({
  default: ({
    onSearch,
    onValueChange,
    value,
    placeholder
  }: {
    value?: string;
    placeholder?: string;
    onSearch: (keyword: string) => void;
    onValueChange?: (value: string) => void;
  }) => (
    <input
      value={value}
      aria-label={placeholder ?? "搜索此歌单"}
      onChange={(event) => {
        onValueChange?.(event.target.value);
        onSearch(event.target.value);
      }}
    />
  )
}));
vi.mock("@/common/components/page/playlist-v2/top", () => ({
  default: ({
    onAddList,
    onPlayAll,
    onToggleSelectionMode,
    children
  }: {
    onAddList: () => void;
    onPlayAll: () => void;
    children: React.ReactNode;
    onToggleSelectionMode: () => void;
  }) => (
    <div>
      <button onClick={onPlayAll}>播放全部</button>
      <button onClick={onAddList}>加入队列</button>
      <button onClick={onToggleSelectionMode}>选择</button>
      {children}
    </div>
  )
}));
vi.mock("@/common/components/page/playlist-v2/similar-playlists", async () => {
  const { useState, useEffect } = await import("react");
  return {
    default: function SimilarPlaylistsMock({ onClick }: { onClick: (id: number) => void }) {
      const [page, setPage] = useState(1);
      useEffect(() => {
        mocks.similar();
        return mocks.similarUnmounts;
      }, []);
      return (
        <div data-page={page} data-testid="similar-playlists">
          <button onClick={() => onClick(9)}>打开相似歌单</button>
          <button onClick={() => setPage((value) => value + 1)}>更多相似歌单</button>
        </div>
      );
    }
  };
});
vi.mock("@/common/components/page/playlist-v2/liked-artists", async () => {
  const { useState, useEffect } = await import("react");
  return {
    default: function LikedArtistsMock({
      onSelect,
      query,
      artists
    }: {
      query: string;
      artists: CollectionItem[];
      onSelect: (artist: CollectionItem) => void;
    }) {
      const [page, setPage] = useState(1);
      mocks.artistProps({ artists, query });
      useEffect(() => {
        mocks.artistMounts();
        return mocks.artistUnmounts;
      }, []);
      useEffect(() => setPage(1), [artists, query]);
      return (
        <div data-page={page} data-query={query} data-testid="liked-artists">
          {artists.map((artist) => (
            <button key={artist.key} onClick={() => onSelect(artist)}>
              查看 {artist.name}
            </button>
          ))}
          <button onClick={() => setPage((value) => value + 1)}>更多歌手</button>
        </div>
      );
    }
  };
});
vi.mock("@/common/components/page/playlist-v2/liked-albums", async () => {
  const { useState, useEffect } = await import("react");
  return {
    default: function LikedAlbumsMock({
      onSelect,
      query,
      albums
    }: {
      query: string;
      albums: CollectionItem[];
      onSelect: (album: CollectionItem) => void;
    }) {
      const [page, setPage] = useState(1);
      mocks.albumProps({ albums, query });
      useEffect(() => {
        mocks.albumMounts();
        return mocks.albumUnmounts;
      }, []);
      useEffect(() => setPage(1), [albums, query]);
      return (
        <div data-page={page} data-query={query} data-testid="liked-albums">
          {albums.map((album) => (
            <button key={album.key} onClick={() => onSelect(album)}>
              查看专辑 {album.name}
            </button>
          ))}
          <button onClick={() => setPage((value) => value + 1)}>更多专辑</button>
        </div>
      );
    }
  };
});
vi.mock("@/common/components/display/track_list", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  return {
    default: function TrackListMock({
      ref,
      onClick,
      tracks,
      selectionMode
    }: {
      ref: Ref<unknown>;
      selectionMode: boolean;
      tracks: { id: number; name: string }[];
      onClick: (track: unknown, index: number) => void;
    }) {
      useImperativeHandle(ref, () => ({ scrollToItem: mocks.scrollToItem }));
      useEffect(() => {
        mocks.mounts();
        return mocks.unmounts;
      }, []);
      return (
        <div data-testid="virtual-track-list" data-selection={String(selectionMode)}>
          {tracks.map((track, index) => (
            <button key={track.id} onClick={() => onClick(track, index)}>
              {track.name}
            </button>
          ))}
        </div>
      );
    }
  };
});
vi.mock("@/common/components/page/playlist-v2/selection-indicator", () => ({
  default: () => <div>批量操作</div>
}));

type Props = ComponentProps<typeof Playlist>;
const tracks = [
  {
    id: 11,
    name: "First song",
    ar: [{ id: 7, name: "Artist A" }],
    al: { id: 10, name: "Alpha album" },
    dt: 60000
  },
  {
    id: 12,
    name: "Second song",
    ar: [{ id: 8, name: "Artist B" }],
    al: { id: 20, name: "Beta album" },
    dt: 120000
  }
];

function props(): Props {
  return {
    id: "1",
    source: "normal",
    routerActive: true,
    user: null,
    heartManager: undefined,
    playableManager: undefined,
    canScrollTop: undefined,
    canFastLocate: undefined,
    activeTrackID: 12,
    onAddList: vi.fn(),
    onReplace: vi.fn(),
    onPlay: vi.fn(),
    onEdited: vi.fn(),
    openComment: vi.fn(),
    addToPlaylistLast: vi.fn(),
    addToPlaylistNext: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    addTracksToPlaylist: vi.fn(),
    onClickAlbum: vi.fn(),
    onClickArtist: vi.fn()
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scrollToItem.mockReset();
  mocks.isMain = true;
  mocks.defaultUseDisplayWindow = false;
  mocks.load.mockResolvedValue({ id: 1, name: "歌单", trackCount: 2, tracks });
  mocks.displayReady.mockResolvedValue(undefined);
});

afterEach(cleanup);

it("keeps the existing track data, callbacks, search and virtual list mounted across tabs", async () => {
  const input = props();
  const view = render(<Playlist {...input} />);
  await view.findByTestId("virtual-track-list");

  fireEvent.click(view.getByRole("button", { name: "播放全部" }));
  fireEvent.click(view.getByRole("button", { name: "加入队列" }));
  fireEvent.click(view.getByRole("button", { name: "Second song" }));
  expect(input.onReplace).toHaveBeenCalledOnce();
  expect(input.onAddList).toHaveBeenCalledOnce();
  expect(input.onPlay).toHaveBeenCalledExactlyOnceWith(tracks[1], 1);

  fireEvent.change(view.getByRole("textbox", { name: "搜索此歌单" }), {
    target: { value: "second" }
  });
  expect(view.queryByText("First song")).not.toBeInTheDocument();
  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  expect(view.getByTestId("virtual-track-list").closest('[role="tabpanel"]')).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  fireEvent.click(view.getByRole("tab", { name: /歌曲/ }));
  expect(view.getByRole("button", { name: "Second song" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "First song" })).toBeInTheDocument();
  expect(view.getByRole("textbox")).toHaveValue("");
  expect(mocks.mounts).toHaveBeenCalledOnce();
  expect(mocks.unmounts).not.toHaveBeenCalled();
});

it("returns to the song tab before selection or locating the playing track", async () => {
  const ref = { current: null as null | PlaylistRef };
  const view = render(<Playlist {...props()} ref={ref} />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  act(() => ref.current?.fastLocator());
  expect(view.getByRole("tab", { name: /歌曲/ })).toHaveAttribute("aria-selected", "true");
  expect(mocks.scrollToItem).toHaveBeenLastCalledWith(1);

  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  fireEvent.click(view.getByRole("button", { name: "选择" }));
  expect(view.getByRole("tab", { name: /歌曲/ })).toHaveAttribute("aria-selected", "true");
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "true");
});

it("waits for the restored song panel and cleared search before locating or returning to the top", async () => {
  loadLikedFixture();
  const ref = { current: null as null | PlaylistRef };
  const view = render(<Playlist {...likedInput()} ref={ref} />);
  const list = await view.findByTestId("virtual-track-list");
  const snapshots: { index: number; hidden: boolean; tracks: string[] }[] = [];
  mocks.scrollToItem.mockImplementation((index: number) => {
    snapshots.push({
      index,
      hidden: list.closest('[role="tabpanel"]')!.classList.contains("hidden"),
      tracks: [...list.querySelectorAll("button")].map((button) => button.textContent ?? "")
    });
  });

  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.change(view.getByRole("textbox"), { target: { value: "artist a" } });
  mocks.scrollToItem.mockClear();
  act(() => {
    ref.current?.fastLocator();
    expect(mocks.scrollToItem).not.toHaveBeenCalled();
  });
  expect(snapshots).toEqual([
    { index: 1, hidden: false, tracks: ["First song", "Second song", "Collaboration"] }
  ]);
  expect(view.getByRole("textbox")).toHaveValue("");

  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  fireEvent.change(view.getByRole("textbox"), { target: { value: "beta" } });
  mocks.scrollToItem.mockClear();
  snapshots.length = 0;
  act(() => {
    ref.current?.scrollTop();
    expect(mocks.scrollToItem).not.toHaveBeenCalled();
  });
  expect(snapshots).toEqual([
    { index: 0, hidden: false, tracks: ["First song", "Second song", "Collaboration"] }
  ]);
  expect(view.getByRole("textbox")).toHaveValue("");
});

it("keeps the fast locator stable and recomputes its target from the latest track order", async () => {
  const ref = { current: null as null | PlaylistRef };
  const input = props();
  const view = render(<Playlist {...input} ref={ref} />);
  await view.findByTestId("virtual-track-list");
  const locate = ref.current!.fastLocator;
  const scrollTop = ref.current!.scrollTop;
  mocks.load.mockResolvedValue({
    id: 2,
    name: "新歌单",
    trackCount: 2,
    tracks: [...tracks].reverse()
  });
  view.rerender(<Playlist {...input} ref={ref} id="2" />);
  await waitFor(() => expect(ref.current?.tracks[0]?.id).toBe(12));
  expect(ref.current!.fastLocator).toBe(locate);
  expect(ref.current!.scrollTop).toBe(scrollTop);
  mocks.scrollToItem.mockClear();
  act(() => locate());
  expect(mocks.scrollToItem).toHaveBeenLastCalledWith(0);
});

it.each([true, false])(
  "opens similar playlists using the current window route when main=%s",
  async (isMain) => {
    mocks.isMain = isMain;
    const view = render(<Playlist {...props()} />);
    await view.findByTestId("virtual-track-list");
    fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
    fireEvent.click(view.getByRole("button", { name: "打开相似歌单" }));
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith("/playlist?id=9&source=normal");
    expect(mocks.display).not.toHaveBeenCalled();
  }
);

it("respects the existing display-window preference from the main window", async () => {
  mocks.defaultUseDisplayWindow = true;
  const view = render(<Playlist {...props()} />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  await act(async () => fireEvent.click(view.getByRole("button", { name: "打开相似歌单" })));
  expect(mocks.preload).toHaveBeenCalledExactlyOnceWith(9);
  expect(mocks.display).toHaveBeenCalledExactlyOnceWith({
    type: "playlist",
    source: "normal",
    id: 9
  });
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it.each(["like", "normal"] as const)(
  "uses local artists instead of similar playlists when the liked list is opened as %s",
  async (source) => {
    const input = props();
    const user = {
      userId: 2,
      profile: { userId: 2 },
      likedPlaylist: { id: 1 },
      likedTrackIDs: { checkPoint: 1 },
      userPlaylists: []
    } as unknown as NonNullable<Props["user"]>;
    const view = render(<Playlist {...input} user={user} source={source} />);
    await view.findByTestId("virtual-track-list");
    expect(view.queryByRole("tab", { name: "相似歌单" })).not.toBeInTheDocument();
    expect(view.getByRole("textbox", { name: "搜索喜欢的音乐" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
    expect(view.getByRole("button", { name: "查看 Artist A" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "查看 Artist B" })).toBeInTheDocument();
    expect(mocks.similar).not.toHaveBeenCalled();
    expect(mocks.load).toHaveBeenCalledExactlyOnceWith(1, expect.any(AbortSignal), true);
  }
);

it("filters liked songs by artist while preserving the full collection and using that artist's playback scope", async () => {
  const ref = { current: null as null | PlaylistRef };
  const input = props();
  const user = {
    userId: 2,
    profile: { userId: 2 },
    likedPlaylist: { id: 1 },
    likedTrackIDs: { checkPoint: 1 },
    userPlaylists: []
  } as unknown as NonNullable<Props["user"]>;
  const collaboration = {
    ...tracks[1],
    id: 13,
    name: "Collaboration",
    ar: [...tracks[0]!.ar, ...tracks[1]!.ar]
  };
  mocks.load.mockResolvedValue({
    id: 1,
    name: "喜欢",
    trackCount: 3,
    tracks: [...tracks, collaboration]
  });
  const view = render(<Playlist {...input} ref={ref} user={user} source="like" />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.click(view.getByRole("button", { name: "查看 Artist A" }));
  expect(view.getByText("已喜欢 2 首")).toBeInTheDocument();
  expect(view.getByRole("button", { name: "First song" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "Collaboration" })).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "Second song" })).not.toBeInTheDocument();
  expect(ref.current?.totalTracks.current).toHaveLength(3);
  expect(ref.current?.playbackTracks?.current.map((track) => track.id)).toEqual([11, 13]);
  fireEvent.click(view.getByRole("button", { name: "Collaboration" }));
  expect(input.onPlay).toHaveBeenCalledExactlyOnceWith(collaboration, 1);
  fireEvent.change(view.getByRole("textbox"), { target: { value: "collaboration" } });
  expect(ref.current?.tracks.map((track) => track.id)).toEqual([13]);
  expect(ref.current?.playbackTracks?.current).toHaveLength(2);
  fireEvent.click(view.getByRole("button", { name: "播放全部" }));
  fireEvent.click(view.getByRole("button", { name: "加入队列" }));
  expect(input.onReplace).toHaveBeenCalledOnce();
  expect(input.onAddList).toHaveBeenCalledOnce();
  fireEvent.click(view.getByRole("button", { name: "返回歌手" }));
  fireEvent.click(view.getByRole("button", { name: "查看 Artist B" }));
  expect(ref.current?.playbackTracks?.current.map((track) => track.id)).toEqual([12, 13]);
  fireEvent.click(view.getByRole("button", { name: "全部歌曲" }));
  fireEvent.change(view.getByRole("textbox"), { target: { value: "" } });
  expect(ref.current?.tracks).toHaveLength(3);
  expect(ref.current?.playbackTracks?.current).toHaveLength(3);
  expect(mocks.mounts).toHaveBeenCalledOnce();
  expect(mocks.unmounts).not.toHaveBeenCalled();
});

function likedInput(playlistID = 1): Props {
  return {
    ...props(),
    source: "like",
    user: {
      userId: 2,
      profile: { userId: 2 },
      likedPlaylist: { id: playlistID },
      likedTrackIDs: { checkPoint: 1 },
      userPlaylists: []
    } as unknown as NonNullable<Props["user"]>
  };
}

function loadLikedFixture() {
  const all = [
    ...tracks,
    {
      ...tracks[1]!,
      id: 13,
      name: "Collaboration",
      ar: [...tracks[0]!.ar, ...tracks[1]!.ar]
    }
  ];
  mocks.load.mockResolvedValue({ id: 1, name: "喜欢", trackCount: all.length, tracks: all });
  return all;
}

it("keeps one controlled search input while WASM searches each tab and tab changes clear the term", async () => {
  loadLikedFixture();
  const view = render(<Playlist {...likedInput()} />);
  await view.findByTestId("virtual-track-list");
  const input = view.getByRole("textbox");
  expect(view.getAllByRole("textbox")).toHaveLength(1);
  expect(view.getByRole("tab", { name: /^按歌手/ })).toHaveTextContent("2");
  expect(view.getByRole("tab", { name: /^按专辑/ })).toHaveTextContent("2");
  fireEvent.change(input, { target: { value: "First" } });
  expect(view.queryByRole("button", { name: "Second song" })).not.toBeInTheDocument();

  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  expect(view.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("");
  expect(input).toHaveAccessibleName("搜索歌手");
  fireEvent.change(input, { target: { value: "artist a" } });
  expect(view.getByRole("button", { name: "查看 Artist A" })).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "查看 Artist B" })).not.toBeInTheDocument();
  expect(view.getByRole("tab", { name: /^按歌手/ })).toHaveTextContent("2");

  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  expect(view.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("");
  expect(input).toHaveAccessibleName("搜索专辑");
  fireEvent.change(input, { target: { value: "beta" } });
  expect(view.getByRole("button", { name: "查看专辑 Beta album" })).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "查看专辑 Alpha album" })).not.toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "查看专辑 Beta album" }));
  expect(input).toHaveValue("");
  expect(input).toHaveAccessibleName("搜索喜欢的音乐");
  expect(view.getByText("已喜欢 2 首")).toBeInTheDocument();
  expect(view.getByRole("button", { name: "Second song" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "Collaboration" })).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "First song" })).not.toBeInTheDocument();
  expect(view.getByRole("button", { name: "返回专辑" })).toBeInTheDocument();
});

it.each([
  [{ kind: "artist", key: "id:7" }, [11, 13]],
  [{ kind: "album", key: "id:20" }, [12, 13]]
] as [PlaylistScope, number[]][])(
  "restores the initial %j range after loading the complete collection",
  async (scope, ids) => {
    loadLikedFixture();
    const ref = { current: null as null | PlaylistRef };
    const view = render(<Playlist {...likedInput()} ref={ref} initialScope={scope} />);
    await view.findByTestId("virtual-track-list");
    expect(ref.current?.scope).toEqual(scope);
    expect(ref.current?.tracks.map((track) => track.id)).toEqual(ids);
    expect(ref.current?.playbackTracks?.current.map((track) => track.id)).toEqual(ids);
    expect(ref.current?.totalTracks.current).toHaveLength(3);
  }
);

it("applies a scope-only navigation without refetching or remounting the virtual list", async () => {
  loadLikedFixture();
  const ref = { current: null as null | PlaylistRef };
  const input = likedInput();
  const view = render(
    <Playlist {...input} ref={ref} initialScope={{ kind: "artist", key: "id:7" }} />
  );
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("button", { name: "选择" }));
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "true");
  view.rerender(<Playlist {...input} ref={ref} initialScope={{ kind: "album", key: "id:20" }} />);
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "false");
  expect(ref.current?.scope).toEqual({ kind: "album", key: "id:20" });
  expect(ref.current?.tracks.map((track) => track.id)).toEqual([12, 13]);
  expect(mocks.load).toHaveBeenCalledOnce();
  view.rerender(<Playlist {...input} ref={ref} initialScope={undefined} />);
  expect(ref.current?.scope).toBeNull();
  expect(ref.current?.tracks).toHaveLength(3);
  expect(mocks.mounts).toHaveBeenCalledOnce();
  expect(mocks.unmounts).not.toHaveBeenCalled();
});

it("falls back to all songs when an initial group no longer exists", async () => {
  loadLikedFixture();
  const ref = { current: null as null | PlaylistRef };
  const view = render(
    <Playlist {...likedInput()} ref={ref} initialScope={{ kind: "album", key: "id:999" }} />
  );
  await view.findByTestId("virtual-track-list");
  expect(ref.current?.scope).toBeNull();
  expect(ref.current?.tracks).toHaveLength(3);
  expect(view.queryByRole("button", { name: "返回专辑" })).not.toBeInTheDocument();
});

it("clears group search when locating, scrolling or selecting returns to songs", async () => {
  loadLikedFixture();
  const ref = { current: null as null | PlaylistRef };
  const view = render(<Playlist {...likedInput()} ref={ref} />);
  await view.findByTestId("virtual-track-list");
  const input = view.getByRole("textbox");
  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.change(input, { target: { value: "artist a" } });
  act(() => ref.current?.fastLocator());
  expect(input).toHaveValue("");
  expect(view.getByRole("button", { name: "Second song" })).toBeInTheDocument();
  expect(mocks.scrollToItem).toHaveBeenLastCalledWith(1);

  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  fireEvent.change(input, { target: { value: "beta" } });
  act(() => ref.current?.scrollTop());
  expect(input).toHaveValue("");
  expect(ref.current?.tracks).toHaveLength(3);

  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.change(input, { target: { value: "artist b" } });
  fireEvent.click(view.getByRole("button", { name: "选择" }));
  expect(input).toHaveValue("");
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "true");
  expect(ref.current?.tracks).toHaveLength(3);
});

function expectPanelVisibility(content: HTMLElement, hidden: boolean) {
  const panel = content.closest<HTMLElement>('[role="tabpanel"]')!;
  expect(panel).toHaveAttribute("aria-hidden", String(hidden));
  if (hidden) {
    expect(panel).toHaveClass("hidden");
    expect(panel).toHaveAttribute("inert");
  } else {
    expect(panel).not.toHaveClass("hidden");
    expect(panel).not.toHaveAttribute("inert");
  }
}

it("mounts similar playlists on first visit and retains their DOM, state and scroll across tabs", async () => {
  const view = render(<Playlist {...props()} />);
  await view.findByTestId("virtual-track-list");
  expect(view.queryByTestId("similar-playlists")).not.toBeInTheDocument();
  expect(mocks.similar).not.toHaveBeenCalled();

  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  const similar = view.getByTestId("similar-playlists");
  expectPanelVisibility(similar, false);
  fireEvent.click(view.getByRole("button", { name: "更多相似歌单" }));
  similar.scrollTop = 240;
  expect(similar).toHaveAttribute("data-page", "2");

  fireEvent.click(view.getByRole("tab", { name: /歌曲/ }));
  expect(view.getByTestId("similar-playlists")).toBe(similar);
  expectPanelVisibility(similar, true);
  expect(similar.scrollTop).toBe(240);
  expect(mocks.similarUnmounts).not.toHaveBeenCalled();

  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  expect(view.getByTestId("similar-playlists")).toBe(similar);
  expectPanelVisibility(similar, false);
  expect(similar).toHaveAttribute("data-page", "2");
  expect(similar.scrollTop).toBe(240);
  expect(mocks.similar).toHaveBeenCalledOnce();
  expect(mocks.similarUnmounts).not.toHaveBeenCalled();
  expect(mocks.load).toHaveBeenCalledOnce();
});

it("lazily mounts liked categories and preserves their local pages and scroll after hiding them", async () => {
  loadLikedFixture();
  const view = render(<Playlist {...likedInput()} />);
  await view.findByTestId("virtual-track-list");
  expect(view.queryByTestId("liked-artists")).not.toBeInTheDocument();
  expect(view.queryByTestId("liked-albums")).not.toBeInTheDocument();

  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  const artists = view.getByTestId("liked-artists");
  expectPanelVisibility(artists, false);
  expect(view.queryByTestId("liked-albums")).not.toBeInTheDocument();
  fireEvent.click(view.getByRole("button", { name: "更多歌手" }));
  artists.scrollTop = 180;

  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  const albums = view.getByTestId("liked-albums");
  expectPanelVisibility(artists, true);
  expectPanelVisibility(albums, false);
  fireEvent.click(view.getByRole("button", { name: "更多专辑" }));
  albums.scrollTop = 320;

  fireEvent.click(view.getByRole("tab", { name: /^歌曲/ }));
  expect(view.getByTestId("liked-artists")).toBe(artists);
  expect(view.getByTestId("liked-albums")).toBe(albums);
  expectPanelVisibility(artists, true);
  expectPanelVisibility(albums, true);
  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  expectPanelVisibility(artists, false);
  expect(artists).toHaveAttribute("data-page", "2");
  expect(artists.scrollTop).toBe(180);
  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  expectPanelVisibility(albums, false);
  expect(albums).toHaveAttribute("data-page", "2");
  expect(albums.scrollTop).toBe(320);
  expect(mocks.artistMounts).toHaveBeenCalledOnce();
  expect(mocks.albumMounts).toHaveBeenCalledOnce();
  expect(mocks.artistUnmounts).not.toHaveBeenCalled();
  expect(mocks.albumUnmounts).not.toHaveBeenCalled();
});

it("keeps hidden category queries empty and their collections stable while searching another tab", async () => {
  loadLikedFixture();
  const view = render(<Playlist {...likedInput()} />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  const artists = view.getByTestId("liked-artists");
  const allArtists = mocks.artistProps.mock.lastCall![0].artists;
  fireEvent.click(view.getByRole("button", { name: "更多歌手" }));
  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  const albums = view.getByTestId("liked-albums");
  const allAlbums = mocks.albumProps.mock.lastCall![0].albums;
  fireEvent.click(view.getByRole("button", { name: "更多专辑" }));
  fireEvent.click(view.getByRole("tab", { name: /^歌曲/ }));

  fireEvent.change(view.getByRole("textbox"), { target: { value: "First" } });
  expect(mocks.artistProps.mock.lastCall![0].query).toBe("");
  expect(mocks.albumProps.mock.lastCall![0].query).toBe("");
  expect(mocks.artistProps.mock.lastCall![0].artists).toBe(allArtists);
  expect(mocks.albumProps.mock.lastCall![0].albums).toBe(allAlbums);
  expect(artists).toHaveAttribute("data-page", "2");
  expect(albums).toHaveAttribute("data-page", "2");

  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  expect(view.getByRole("textbox")).toHaveValue("");
  fireEvent.change(view.getByRole("textbox"), { target: { value: "beta" } });
  expect(mocks.albumProps.mock.lastCall![0].query).toBe("beta");
  expect(mocks.artistProps.mock.lastCall![0].query).toBe("");
  expect(mocks.artistProps.mock.lastCall![0].artists).toBe(allArtists);
  expect(artists).toHaveAttribute("data-page", "2");

  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  expect(view.getByRole("textbox")).toHaveValue("");
  expect(view.getByTestId("liked-artists")).toBe(artists);
  expect(artists).toHaveAttribute("data-page", "2");
  fireEvent.change(view.getByRole("textbox"), { target: { value: "artist a" } });
  expect(mocks.artistProps.mock.lastCall![0].query).toBe("artist a");
  expect(mocks.albumProps.mock.lastCall![0].query).toBe("");
  expect(mocks.albumProps.mock.lastCall![0].albums).toBe(allAlbums);
  expect(view.getByTestId("liked-albums")).toBe(albums);
  expect(mocks.artistMounts).toHaveBeenCalledOnce();
  expect(mocks.albumMounts).toHaveBeenCalledOnce();
  expect(mocks.artistUnmounts).not.toHaveBeenCalled();
  expect(mocks.albumUnmounts).not.toHaveBeenCalled();
});

function resourceFixture(id: number, songName: string) {
  return {
    id,
    name: `歌单 ${id}`,
    trackCount: tracks.length,
    tracks: tracks.map((track, index) => ({
      ...track,
      name: index === 0 ? songName : track.name
    }))
  };
}

it("clears visited panels when the playlist id changes", async () => {
  const input = props();
  const view = render(<Playlist {...input} />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  const previous = view.getByTestId("similar-playlists");
  fireEvent.click(view.getByRole("button", { name: "更多相似歌单" }));
  fireEvent.click(view.getByRole("tab", { name: /^歌曲/ }));

  mocks.load.mockResolvedValue(resourceFixture(2, "New playlist song"));
  view.rerender(<Playlist {...input} id="2" />);
  await view.findByRole("button", { name: "New playlist song" });
  expect(view.queryByTestId("similar-playlists")).not.toBeInTheDocument();
  expect(mocks.similar).toHaveBeenCalledOnce();
  expect(mocks.similarUnmounts).toHaveBeenCalledOnce();

  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  expect(view.getByTestId("similar-playlists")).not.toBe(previous);
  expect(view.getByTestId("similar-playlists")).toHaveAttribute("data-page", "1");
  expect(mocks.similar).toHaveBeenCalledTimes(2);
});

it("clears visited panels across source changes even when returning to the same normal playlist", async () => {
  const input = { ...props(), user: likedInput(100).user };
  const view = render(<Playlist {...input} />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  fireEvent.click(view.getByRole("tab", { name: /^歌曲/ }));

  mocks.load.mockResolvedValue(resourceFixture(100, "Liked source song"));
  view.rerender(<Playlist {...input} source="like" />);
  await view.findByRole("button", { name: "Liked source song" });
  expect(view.queryByTestId("similar-playlists")).not.toBeInTheDocument();
  mocks.load.mockResolvedValue(resourceFixture(1, "Normal source song"));
  view.rerender(<Playlist {...input} source="normal" />);
  await view.findByRole("button", { name: "Normal source song" });
  expect(view.queryByTestId("similar-playlists")).not.toBeInTheDocument();
  expect(mocks.similar).toHaveBeenCalledOnce();
  expect(mocks.similarUnmounts).toHaveBeenCalledOnce();
  expect(view.getByRole("tab", { name: /^歌曲/ })).toHaveAttribute("aria-selected", "true");
});

it("clears visited liked categories when the user's liked playlist changes", async () => {
  loadLikedFixture();
  const view = render(<Playlist {...likedInput()} />);
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  fireEvent.click(view.getByRole("tab", { name: /^歌曲/ }));

  mocks.load.mockResolvedValue(resourceFixture(2, "Another liked playlist song"));
  view.rerender(<Playlist {...likedInput(2)} />);
  await view.findByRole("button", { name: "Another liked playlist song" });
  await waitFor(() =>
    expect(mocks.load).toHaveBeenLastCalledWith(2, expect.any(AbortSignal), true)
  );
  expect(view.queryByTestId("liked-artists")).not.toBeInTheDocument();
  expect(view.queryByTestId("liked-albums")).not.toBeInTheDocument();
  expect(mocks.artistMounts).toHaveBeenCalledOnce();
  expect(mocks.albumMounts).toHaveBeenCalledOnce();
  expect(mocks.artistUnmounts).toHaveBeenCalledOnce();
  expect(mocks.albumUnmounts).toHaveBeenCalledOnce();
});
