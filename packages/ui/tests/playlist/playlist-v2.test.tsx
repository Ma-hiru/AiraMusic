import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Playlist from "@mahiru/ui/common/components/page/playlist-v2";
import type { Ref, ComponentProps } from "react";
import type { PlaylistScope } from "@mahiru/ui/common/types/playlist-scope";
import type { PlaylistRef } from "@mahiru/ui/common/components/page/playlist-v2";

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
vi.mock("@/common/components/page/playlist-v2/similar-playlists", () => ({
  default: ({ onClick }: { onClick: (id: number) => void }) => {
    mocks.similar();
    return <button onClick={() => onClick(9)}>打开相似歌单</button>;
  }
}));
vi.mock("@/common/components/page/playlist-v2/liked-artists", () => ({
  default: ({
    onSelect,
    artists
  }: {
    onSelect: (artist: unknown) => void;
    artists: { key: string; name: string }[];
  }) => (
    <div>
      {artists.map((artist) => (
        <button key={artist.key} onClick={() => onSelect(artist)}>
          查看 {artist.name}
        </button>
      ))}
    </div>
  )
}));
vi.mock("@/common/components/page/playlist-v2/liked-albums", () => ({
  default: ({
    onSelect,
    albums
  }: {
    onSelect: (album: unknown) => void;
    albums: { key: string; name: string }[];
  }) => (
    <div>
      {albums.map((album) => (
        <button key={album.key} onClick={() => onSelect(album)}>
          查看专辑 {album.name}
        </button>
      ))}
    </div>
  )
}));
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

function likedInput(): Props {
  return {
    ...props(),
    source: "like",
    user: {
      userId: 2,
      profile: { userId: 2 },
      likedPlaylist: { id: 1 },
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
