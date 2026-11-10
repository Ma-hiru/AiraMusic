import { act, render, cleanup, fireEvent } from "@testing-library/react";
import { RoutePathMain, RoutePathDisplay } from "@mahiru/ui/common/routes";
import MainPlaylist from "@mahiru/ui/wins/main/pages/playlist";
import DisplayPlaylist from "@mahiru/ui/wins/display/pages/playlist";
import type { PlaylistScope } from "@mahiru/ui/common/types/playlist-scope";
import type { PlaylistRef } from "@mahiru/ui/common/components/page/playlist-switch";
import type { PlaylistModifyType } from "@mahiru/ui/common/hooks/use-playlist-modify-sync";

const mocks = vi.hoisted(() => {
  const noop = () => {};
  return {
    user: { likedPlaylist: { id: 100 } },
    location: { pathname: "/playlist", search: "?source=like" },
    navigate: vi.fn(),
    displayReady: vi.fn(),
    deliver: vi.fn(),
    modifiedTwoWay: vi.fn(),
    modifiedDeliver: vi.fn(),
    markBack: vi.fn(),
    setTyping: vi.fn(),
    mainPlayer: vi.fn(),
    displayPlayer: vi.fn(),
    setTitle: vi.fn(),
    playlistProps: null as unknown as {
      onDeleted: () => void;
      onPageAction: () => void;
      initialScope?: PlaylistScope;
      onEdited: (modifies: PlaylistModifyType[]) => void;
    },
    playlistRef: null as unknown as PlaylistRef,
    player: { current: { track: null } },
    actions: {
      addTrackToPlaylistLast: noop,
      addTrackToPlaylistNext: noop,
      openTrackComment: noop,
      onAddList: noop,
      onReplace: noop,
      onTrackPlay: noop
    },
    managers: { heartManager: noop, playableManager: noop },
    collectionActions: { addTrackToPlaylist: noop, addTracksToPlaylist: noop },
    scrollActions: { canScrollTop: noop, canFastLocate: noop },
    background: { setBackground: noop },
    listen: vi.fn(() => noop)
  };
});

vi.mock("jotai", () => ({ useSetAtom: () => mocks.setTyping }));
vi.mock("react-router-dom", () => ({
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate
}));
vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/wins/main/atoms/layout", () => ({ typingAtom: {}, scrollActionsAtom: {} }));
vi.mock("@/wins/display/atoms/layout", () => ({ scrollActionsAtom: {} }));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: { display: { reactReadyAwait: mocks.displayReady } }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    trackMeta: { data: null },
    display: { deliver: mocks.deliver },
    modified: { twoWay: mocks.modifiedTwoWay, deliver: mocks.modifiedDeliver }
  }
}));
vi.mock("@/common/lib/modified", () => ({ RendererModified: { listen: mocks.listen } }));
vi.mock("@/common/hooks/use-router-active", () => ({ useRouterActive: () => true }));
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (value: unknown) => value }));
vi.mock("@/common/hooks/use-user-track-manager", () => ({
  useUserTrackManager: () => mocks.managers
}));
vi.mock("@/common/hooks/use-track-add-to-playlist", () => ({
  useTrackAddToPlaylist: () => mocks.collectionActions
}));
vi.mock("@/common/hooks/use-scroll-actions-register", () => ({
  useScrollActionsRegister: () => mocks.scrollActions
}));
vi.mock("@/wins/main/hooks/use-page-jump", () => ({
  usePageJump: () => ({ jumpAlbumPage: vi.fn(), jumpArtistPage: vi.fn() })
}));
vi.mock("@/wins/main/hooks/use-set-background", () => ({
  useSetBackground: () => mocks.background
}));
vi.mock("@/wins/main/hooks/use-player-action-in-list", () => ({
  usePlayerActionInList: (getTracks: unknown) => {
    mocks.mainPlayer(getTracks);
    return { ...mocks.actions, player: mocks.player };
  }
}));
vi.mock("@/wins/display/hooks/use-player-change-action-for-playlist-from-display", () => ({
  usePlayerChangeActionForPlaylistFromDisplay: (options: unknown) => {
    mocks.displayPlayer(options);
    return mocks.actions;
  }
}));
vi.mock("@/wins/display/hooks/use-artist-or-album-display-jump", () => ({
  useArtistOrAlbumDisplayJump: () => ({ jumpAlbumDisplay: vi.fn(), jumpArtistDisplay: vi.fn() })
}));
vi.mock("@/wins/display/hooks/use-display-title", () => ({
  useDisplayTitleRegister: () => ({ setTitle: mocks.setTitle })
}));
vi.mock("@/wins/display/ctx/back", () => ({
  useBack: () => ({ markBack: mocks.markBack })
}));
vi.mock("@/common/components/page/playlist-switch", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    default: function PlaylistMock({
      ref,
      ...props
    }: {
      onDeleted: () => void;
      onPageAction: () => void;
      ref: React.Ref<PlaylistRef>;
      initialScope?: PlaylistScope;
      onEdited: (modifies: PlaylistModifyType[]) => void;
    }) {
      mocks.playlistProps = props;
      useImperativeHandle(ref, () => mocks.playlistRef);
      return <button onClick={props.onPageAction}>切换窗口</button>;
    }
  };
});

const totalTracks = [{ id: 11 }, { id: 12 }, { id: 13 }];
const playbackTracks = [totalTracks[0], totalTracks[2]];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.displayReady.mockResolvedValue(undefined);
  mocks.location = { pathname: "/playlist", search: "?source=like" };
  mocks.playlistRef = {
    scope: null,
    playbackTracks: { current: playbackTracks },
    totalTracks: { current: totalTracks }
  } as unknown as PlaylistRef;
});
afterEach(cleanup);

it.each([
  { name: "main", Component: MainPlaylist, route: RoutePathMain },
  { name: "display", Component: DisplayPlaylist, route: RoutePathDisplay }
])(
  "passes the initial scope and reads the latest selected scope when $name switches windows",
  async ({ name, route, Component }) => {
    const initialScope: PlaylistScope = { kind: "artist", key: "name:匿名歌手" };
    const path = route.playlist.withQuery(null, "like", initialScope);
    mocks.location.search = path.slice(path.indexOf("?"));
    const view = render(<Component />);

    expect(mocks.playlistProps.initialScope).toEqual(initialScope);
    const changedScope: PlaylistScope = { kind: "album", key: "id:22" };
    mocks.playlistRef.scope = changedScope;
    await act(async () => fireEvent.click(view.getByRole("button", { name: "切换窗口" })));

    const payload = { type: "playlist", id: 100, source: "like", scope: changedScope };
    if (name === "main") {
      expect(mocks.displayReady).toHaveBeenCalledOnce();
      expect(mocks.deliver).toHaveBeenCalledExactlyOnceWith(payload);
    } else {
      expect(mocks.deliver).toHaveBeenCalledExactlyOnceWith(payload, "main");
      expect(mocks.markBack).toHaveBeenCalledOnce();
    }
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith(-1);
  }
);

it.each([
  { name: "main", Component: MainPlaylist },
  { name: "display", Component: DisplayPlaylist }
])("keeps old links and legacy playlist refs compatible in $name", async ({ name, Component }) => {
  mocks.location.search = "?id=200&source=normal";
  delete mocks.playlistRef.scope;
  delete mocks.playlistRef.playbackTracks;
  const view = render(<Component />);

  expect(mocks.playlistProps.initialScope).toBeUndefined();
  await act(async () => fireEvent.click(view.getByRole("button", { name: "切换窗口" })));
  const payload = { type: "playlist", id: 200, source: "normal", scope: undefined };
  if (name === "main") {
    expect(mocks.deliver).toHaveBeenCalledWith(payload);
    const getTracks = mocks.mainPlayer.mock.calls[0]![0] as () => unknown[];
    expect(getTracks()).toBe(totalTracks);
  } else {
    expect(mocks.deliver).toHaveBeenCalledWith(payload, "main");
    const options = mocks.displayPlayer.mock.calls[0]![0] as {
      markId: string;
      sourceID: number;
      getTracks: () => unknown[];
    };
    expect(options.getTracks()).toBe(totalTracks);
    expect(options.sourceID).toBe(200);
    expect(options.markId).toBe("playlist-200");
  }
});

it("uses the real liked playlist ID and selected playback range for display playback actions", () => {
  render(<DisplayPlaylist />);
  const options = mocks.displayPlayer.mock.calls[0]![0] as {
    markId: string;
    sourceID: number;
    getTracks: () => unknown[];
  };

  expect(options.sourceID).toBe(100);
  expect(options.markId).toBe("playlist-100");
  expect(options.getTracks()).toBe(playbackTracks);
  expect(mocks.playlistRef.totalTracks.current).toBe(totalTracks);
});

it.each([
  { name: "main", Component: MainPlaylist },
  { name: "display", Component: DisplayPlaylist }
])(
  "refreshes user playlists and syncs playlist details after starring in $name",
  ({ Component }) => {
    mocks.location.search = "?id=200&source=normal";
    render(<Component />);

    act(() => mocks.playlistProps.onEdited(["star"]));

    expect(mocks.modifiedTwoWay).toHaveBeenCalledExactlyOnceWith({ type: "user-playlist" });
    expect(mocks.modifiedDeliver).toHaveBeenCalledExactlyOnceWith({
      type: "playlist-update",
      id: "200",
      source: "normal"
    });
  }
);

it.each([
  { name: "main", Component: MainPlaylist },
  { name: "display", Component: DisplayPlaylist }
])("keeps metadata and deletion notifications synchronized in $name", ({ Component }) => {
  mocks.location.search = "?id=200&source=normal";
  render(<Component />);

  act(() => mocks.playlistProps.onEdited(["meta"]));

  expect(mocks.modifiedTwoWay).toHaveBeenCalledTimes(2);
  expect(mocks.modifiedTwoWay).toHaveBeenNthCalledWith(1, { type: "user-playlist" });
  expect(mocks.modifiedTwoWay).toHaveBeenNthCalledWith(2, {
    type: "playlist-update",
    id: "200",
    source: "normal"
  });
  expect(mocks.modifiedDeliver).not.toHaveBeenCalled();

  mocks.modifiedTwoWay.mockClear();
  act(() => mocks.playlistProps.onDeleted());

  expect(mocks.modifiedTwoWay).toHaveBeenCalledTimes(2);
  expect(mocks.modifiedTwoWay).toHaveBeenNthCalledWith(1, { type: "user-playlist" });
  expect(mocks.modifiedTwoWay).toHaveBeenNthCalledWith(2, { type: "remove-playlist", id: "200" });
  expect(mocks.modifiedDeliver).not.toHaveBeenCalled();
});
