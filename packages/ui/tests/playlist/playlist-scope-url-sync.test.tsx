import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { useLocation, RouterProvider, createMemoryRouter } from "react-router-dom";
import { RoutePathMain, RoutePathDisplay } from "@mahiru/ui/common/routes";
import Playlist from "@mahiru/ui/common/components/page/playlist-v2";
import KeepAliveOutlet from "@mahiru/ui/common/components/other/keep-alive-outlet";
import type { Ref, ReactNode, ComponentProps } from "react";
import type { PlaylistScope } from "@mahiru/ui/common/types/playlist-scope";
import type { PlaylistRef } from "@mahiru/ui/common/components/page/playlist-v2";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  scrollToItem: vi.fn(),
  mounts: vi.fn(),
  unmounts: vi.fn(),
  isMain: true
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
    display: { reactReadyAwait: vi.fn() }
  }
}));
vi.mock("@/common/store/settings", () => ({
  settingsStoreSnapshot: () => ({
    _settings: { preference: { defaultUseDisplayWindow: false } }
  })
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    display: { deliver: vi.fn() },
    modified: { twoWay: vi.fn() }
  }
}));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesPlaylist: { id: mocks.load, preload: vi.fn() }
}));
vi.mock("@/common/netease/api", () => ({ NeteaseAPIPlaylist: { modify: vi.fn() } }));
vi.mock("@/common/netease/models", () => ({
  NeteaseTrackRecord: { fromPlaylist: (playlist: { tracks: unknown[] }) => playlist.tracks }
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
      aria-label={placeholder}
      onChange={(event) => {
        onValueChange?.(event.target.value);
        onSearch(event.target.value);
      }}
    />
  )
}));
vi.mock("@/common/components/page/playlist-v2/top", () => ({
  default: ({
    onLocateSong,
    onToggleSelectionMode,
    children
  }: {
    children: ReactNode;
    onToggleSelectionMode: () => void;
    onLocateSong: (id: number) => void;
  }) => (
    <div>
      <button onClick={onToggleSelectionMode}>选择</button>
      <button onClick={() => onLocateSong(12)}>定位 Second song</button>
      {children}
    </div>
  )
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
vi.mock("@/common/components/page/playlist-v2/similar-playlists", () => ({
  default: () => <div>相似歌单内容</div>
}));
vi.mock("@/common/components/display/track_list", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  return {
    default: function TrackListMock({
      ref,
      tracks,
      selectionMode
    }: {
      ref: Ref<unknown>;
      selectionMode: boolean;
      tracks: { id: number; name: string }[];
    }) {
      useImperativeHandle(ref, () => ({ scrollToItem: mocks.scrollToItem }));
      useEffect(() => {
        mocks.mounts();
        return mocks.unmounts;
      }, []);
      return (
        <div data-testid="virtual-track-list" data-selection={String(selectionMode)}>
          {tracks.map((track) => (
            <div key={track.id}>{track.name}</div>
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
  },
  {
    id: 13,
    name: "Collaboration",
    ar: [
      { id: 7, name: "Artist A" },
      { id: 8, name: "Artist B" }
    ],
    al: { id: 20, name: "Beta album" },
    dt: 120000
  }
];
const artist: PlaylistScope = { kind: "artist", key: "id:7" };
const album: PlaylistScope = { kind: "album", key: "id:20" };
const user = {
  profile: { userId: 2 },
  likedPlaylist: { id: 1 },
  likedTrackIDs: { checkPoint: 1 }
} as NonNullable<Props["user"]>;

function props(): Omit<Props, "id" | "source" | "routerActive"> {
  return {
    user,
    heartManager: undefined,
    playableManager: undefined,
    canScrollTop: undefined,
    canFastLocate: undefined,
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

const routers: ReturnType<typeof createMemoryRouter>[] = [];

function setup(path = "/playlist?source=like") {
  const ref = { current: null as Nullable<PlaylistRef> };
  const routes = mocks.isMain ? RoutePathMain : RoutePathDisplay;
  const actions: string[] = [];
  function PlaylistAdapter() {
    const location = useLocation();
    const { id, source, scope } = routes.playlist.parseQuery(location);
    return (
      <Playlist
        {...props()}
        ref={ref}
        id={id}
        source={source}
        initialScope={scope}
        routerActive={location.pathname === routes.playlist.base}
      />
    );
  }
  const router = createMemoryRouter(
    [
      {
        element: <KeepAliveOutlet />,
        children: [
          { path: "/playlist", element: <PlaylistAdapter /> },
          { path: "/home", element: <div>首页</div> }
        ]
      }
    ],
    { initialEntries: ["/home", path], initialIndex: 1 }
  );
  router.subscribe((state) => actions.push(state.historyAction));
  routers.push(router);
  return { ...render(<RouterProvider router={router} />), router, ref, actions };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isMain = true;
  mocks.load.mockImplementation(async (id: number) => ({
    id,
    name: "歌单",
    trackCount: tracks.length,
    tracks
  }));
  for (const route of [RoutePathMain, RoutePathDisplay]) {
    route.playlist.queryCache = { id: null, source: null };
  }
});

afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) router.dispose();
});

it.each([true, false])(
  "replaces the current liked URL and restores all songs after a cached-page merge when main=%s",
  async (isMain) => {
    mocks.isMain = isMain;
    const path = "/playlist?source=like&tag=kept#collection";
    const view = setup(path);
    await view.findByTestId("virtual-track-list");
    fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
    fireEvent.click(view.getByRole("button", { name: "查看 Artist A" }));

    await waitFor(() => expect(view.ref.current?.scope).toEqual(artist));
    const search = new URLSearchParams(view.router.state.location.search);
    expect(JSON.parse(search.get("scope")!)).toEqual(artist);
    expect(search.get("source")).toBe("like");
    expect(search.get("tag")).toBe("kept");
    expect(search.has("id")).toBe(false);
    expect(view.router.state.location.hash).toBe("#collection");
    expect(view.actions).toEqual(["REPLACE"]);
    expect(view.ref.current?.tracks.map((track) => track.id)).toEqual([11, 13]);

    await act(() => view.router.navigate(-1));
    expect(view.router.state.location.pathname).toBe("/home");
    expect(view.ref.current?.scope).toEqual(artist);
    await act(() => view.router.navigate(path));

    await waitFor(() => expect(view.ref.current?.scope).toBeNull());
    expect(view.ref.current?.tracks.map((track) => track.id)).toEqual([11, 12, 13]);
    expect(view.ref.current?.playbackTracks?.current).toHaveLength(3);
    expect(view.getByRole("tab", { name: /^歌曲/ })).toHaveAttribute("aria-selected", "true");
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.mounts).toHaveBeenCalledOnce();
    expect(mocks.unmounts).not.toHaveBeenCalled();
  }
);

it.each(["按歌手", "按专辑"])(
  "keeps %s selected when clearing the route scope echoes back through initialScope",
  async (label) => {
    const view = setup(RoutePathMain.playlist.withQuery(null, "like", artist));
    await view.findByTestId("virtual-track-list");
    fireEvent.click(view.getByRole("tab", { name: new RegExp(`^${label}`) }));

    await waitFor(() => {
      expect(new URLSearchParams(view.router.state.location.search).has("scope")).toBe(false);
      expect(view.getByRole("tab", { name: new RegExp(`^${label}`) })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });
    expect(view.ref.current?.scope).toBeNull();
    expect(view.getByRole("textbox")).toHaveValue("");
    expect(view.actions).toEqual(["REPLACE"]);
    expect(mocks.load).toHaveBeenCalledOnce();
  }
);

it("writes album selection and clears the URL scope for all songs and locating another song", async () => {
  const view = setup("/playlist?id=1&source=normal&tag=kept#collection");
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: /^按专辑/ }));
  fireEvent.click(view.getByRole("button", { name: "查看专辑 Beta album" }));
  await waitFor(() => expect(view.ref.current?.scope).toEqual(album));
  expect(JSON.parse(new URLSearchParams(view.router.state.location.search).get("scope")!)).toEqual(
    album
  );
  expect(view.ref.current?.tracks.map((track) => track.id)).toEqual([12, 13]);
  fireEvent.change(view.getByRole("textbox"), { target: { value: "collaboration" } });
  fireEvent.click(view.getByRole("button", { name: "选择" }));
  fireEvent.click(view.getByRole("button", { name: "全部歌曲" }));
  await waitFor(() => expect(view.ref.current?.scope).toBeNull());
  expect(view.getByRole("textbox")).toHaveValue("");
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "false");
  expect(new URLSearchParams(view.router.state.location.search).has("scope")).toBe(false);
  expect(view.ref.current?.tracks).toHaveLength(3);

  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.click(view.getByRole("button", { name: "查看 Artist A" }));
  await waitFor(() => expect(view.ref.current?.scope).toEqual(artist));
  fireEvent.click(view.getByRole("button", { name: "定位 Second song" }));
  await waitFor(() => expect(view.ref.current?.scope).toBeNull());
  expect(new URLSearchParams(view.router.state.location.search).has("scope")).toBe(false);
  expect(new URLSearchParams(view.router.state.location.search).get("id")).toBe("1");
  expect(new URLSearchParams(view.router.state.location.search).get("source")).toBe("normal");
  expect(new URLSearchParams(view.router.state.location.search).get("tag")).toBe("kept");
  expect(view.router.state.location.hash).toBe("#collection");
  expect(mocks.scrollToItem).toHaveBeenLastCalledWith(1);
  expect(view.actions).toEqual(["REPLACE", "REPLACE", "REPLACE", "REPLACE"]);
  expect(mocks.load).toHaveBeenCalledOnce();
});

it("applies external scope-only routes while clearing search and selection without reloading", async () => {
  const view = setup(RoutePathMain.playlist.withQuery(null, "like", artist));
  await view.findByTestId("virtual-track-list");
  fireEvent.change(view.getByRole("textbox"), { target: { value: "collaboration" } });
  fireEvent.click(view.getByRole("button", { name: "选择" }));
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "true");
  await act(() =>
    view.router.navigate(RoutePathMain.playlist.withQuery(null, "like", album), { replace: true })
  );
  expect(view.ref.current?.scope).toEqual(album);
  expect(view.ref.current?.tracks.map((track) => track.id)).toEqual([12, 13]);
  expect(view.getByRole("textbox")).toHaveValue("");
  expect(view.getByTestId("virtual-track-list")).toHaveAttribute("data-selection", "false");
  await act(() =>
    view.router.navigate(RoutePathMain.playlist.withQuery(null, "like"), { replace: true })
  );
  expect(view.ref.current?.scope).toBeNull();
  expect(view.ref.current?.tracks).toHaveLength(3);
  expect(mocks.load).toHaveBeenCalledOnce();
  expect(mocks.mounts).toHaveBeenCalledOnce();
  expect(mocks.unmounts).not.toHaveBeenCalled();
});

it("resets tabs on resource changes even when both route scopes are empty", async () => {
  const view = setup();
  await view.findByTestId("virtual-track-list");
  fireEvent.click(view.getByRole("tab", { name: /^按歌手/ }));
  fireEvent.change(view.getByRole("textbox"), { target: { value: "artist a" } });
  await act(() => view.router.navigate(RoutePathMain.playlist.withQuery(2, "normal")));
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  expect(view.getByRole("tab", { name: /^歌曲/ })).toHaveAttribute("aria-selected", "true");
  expect(view.getByRole("textbox")).toHaveValue("");
  expect(view.getByRole("tab", { name: "相似歌单" })).toBeInTheDocument();
  expect(view.ref.current?.scope).toBeNull();
});

it("does not navigate when ordinary playlist tabs change", async () => {
  const view = setup("/playlist?id=2&source=normal&tag=kept#collection");
  await view.findByTestId("virtual-track-list");
  const location = view.router.state.location;
  fireEvent.click(view.getByRole("tab", { name: "相似歌单" }));
  expect(view.getByText("相似歌单内容")).toBeInTheDocument();
  fireEvent.click(view.getByRole("tab", { name: /^歌曲/ }));
  expect(view.router.state.location).toBe(location);
  expect(view.actions).toEqual([]);
  expect(view.ref.current?.tracks).toHaveLength(3);
});
