import { act, render, cleanup, fireEvent } from "@testing-library/react";
import { NeteaseImageSize } from "@mahiru/ui/common/enum";
import Album from "@mahiru/ui/common/components/page/album-v2";
import type { Ref, ReactNode, ComponentProps } from "react";
import type { AlbumPageRef } from "@mahiru/ui/common/components/page/album-v2";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  dynamic: vi.fn(),
  mounts: vi.fn(),
  unmounts: vi.fn(),
  menu: vi.fn()
}));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesAlbum: { id: mocks.load, dynamic: mocks.dynamic }
}));
vi.mock("@/common/lib/log", () => ({ Log: { info: vi.fn() } }));
vi.mock("@/common/lib/net", () => ({ RendererNet: {} }));
vi.mock("@/common/hooks/use-online", () => ({ useOnline: () => ({ online: true }) }));
vi.mock("@/common/hooks/use-agent-focus-ctx", () => ({ useAgentFocusCtx: vi.fn() }));
vi.mock("@/common/hooks/use-track-context-menu", () => ({
  useTrackContextMenu: (p: unknown) => {
    mocks.menu(p);
    return { onContextMenu: vi.fn() };
  }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/data-input/search", () => ({
  default: ({
    setIsTyping,
    onSearch
  }: {
    onSearch: (s: string) => void;
    setIsTyping: (v: boolean) => void;
  }) => (
    <input
      aria-label="搜索此专辑"
      onBlur={() => setIsTyping(false)}
      onFocus={() => setIsTyping(true)}
      onChange={(e) => onSearch(e.target.value)}
    />
  )
}));
vi.mock("@/common/components/page/album-v2/top", () => ({
  default: ({
    onAddList,
    onPlayAll,
    children
  }: {
    children: ReactNode;
    onAddList: () => void;
    onPlayAll: () => void;
  }) => (
    <div>
      <button onClick={onPlayAll}>播放全部</button>
      <button onClick={onAddList}>加入队列</button>
      {children}
    </div>
  )
}));
vi.mock("@/common/components/page/album-v2/artist-albums", () => ({
  default: ({ onClick, artistID }: { artistID: number; onClick: (id: number) => void }) => (
    <button data-artist={artistID} data-testid="other-albums" onClick={() => onClick(9)}>
      打开歌手专辑
    </button>
  )
}));
vi.mock("@/common/components/display/track_list", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  return {
    default: function TrackListMock({
      ref,
      onClick,
      tracks
    }: {
      ref: Ref<unknown>;
      onClick: (t: unknown, i: number) => void;
      tracks: { id: number; detail: { name: string } }[];
    }) {
      useImperativeHandle(ref, () => ({ scrollToItem: vi.fn() }));
      useEffect(() => {
        mocks.mounts();
        return mocks.unmounts;
      }, []);
      return (
        <div data-testid="virtual-album-tracks">
          {tracks.map((track, index) => (
            <button key={track.id} onClick={() => onClick(track, index)}>
              {track.detail.name}
            </button>
          ))}
        </div>
      );
    }
  };
});
type Props = ComponentProps<typeof Album>;
function fixture(id = 1) {
  return {
    content: { id, name: `Album ${id}`, artist: { id: 7 }, artists: [{ id: 7 }] },
    tracks: [
      {
        id: id * 10 + 1,
        detail: {
          name: "First song",
          al: { name: "Album" },
          ar: [{ name: "Artist" }],
          alia: ["Opening"],
          tns: []
        }
      },
      {
        id: id * 10 + 2,
        detail: {
          name: "Second song",
          al: { name: "Album" },
          ar: [{ name: "Guest" }],
          alia: [],
          tns: ["Ending"]
        }
      }
    ]
  };
}
function props(): Props {
  return {
    id: 1,
    user: null,
    coverSize: NeteaseImageSize.lg,
    routerActive: true,
    pageActionType: "out",
    activeTrackID: undefined,
    heartManager: { TrackLikedSource: undefined, onLikedSynced: vi.fn() },
    playableManager: vi.fn(),
    addToPlaylistLast: vi.fn(),
    addToPlaylistNext: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    openComment: vi.fn(),
    onAddList: vi.fn(),
    onPageAction: vi.fn(),
    onClickAlbum: vi.fn(),
    onClickArtist: vi.fn(),
    onClick: vi.fn(),
    onReplace: vi.fn(),
    onDataLoaded: vi.fn(),
    setIsTyping: vi.fn()
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue(fixture());
  mocks.dynamic.mockResolvedValue({ isSub: false, subCount: 10 });
});
afterEach(cleanup);

it("retains album loading, complete ref data and existing track/context callbacks", async () => {
  const input = props();
  const ref = { current: null as null | AlbumPageRef };
  const view = render(<Album {...input} ref={ref} />);
  await view.findByTestId("virtual-album-tracks");
  expect(mocks.load).toHaveBeenCalledWith(1);
  expect(mocks.dynamic).toHaveBeenCalledWith(1);
  expect(ref.current?.album?.tracks).toHaveLength(2);
  expect(ref.current?.dynamic?.subCount).toBe(10);
  expect(ref.current?.trackListRef).not.toBeNull();
  expect(input.onDataLoaded).toHaveBeenCalledWith(
    expect.objectContaining({ content: expect.objectContaining({ id: 1 }) })
  );
  fireEvent.click(view.getByRole("button", { name: "Second song" }));
  expect(input.onClick).toHaveBeenCalledWith(fixture().tracks[1], 1);
  expect(mocks.menu).toHaveBeenCalledWith(
    expect.objectContaining({
      onPlay: input.onClick,
      addTrackToPlaylist: input.addTrackToPlaylist,
      openComment: input.openComment
    })
  );
});
it("searches album fields without replacing the complete album or remounting virtual tracks across tabs", async () => {
  const input = props();
  const ref = { current: null as null | AlbumPageRef };
  const view = render(<Album {...input} ref={ref} />);
  await view.findByTestId("virtual-album-tracks");
  fireEvent.focus(view.getByRole("textbox", { name: "搜索此专辑" }));
  expect(input.setIsTyping).toHaveBeenLastCalledWith(true);
  fireEvent.change(view.getByRole("textbox"), { target: { value: "ending" } });
  expect(view.queryByRole("button", { name: "First song" })).not.toBeInTheDocument();
  expect(ref.current?.album?.tracks).toHaveLength(2);
  fireEvent.click(view.getByRole("tab", { name: "其他专辑" }));
  expect(view.getByTestId("virtual-album-tracks").closest('[role="tabpanel"]')).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  expect(view.getByTestId("other-albums")).toHaveAttribute("data-artist", "7");
  fireEvent.click(view.getByRole("button", { name: "打开歌手专辑" }));
  expect(input.onClickAlbum).toHaveBeenCalledExactlyOnceWith(9);
  fireEvent.click(view.getByRole("tab", { name: /歌曲/ }));
  expect(view.getByRole("button", { name: "Second song" })).toBeInTheDocument();
  expect(mocks.mounts).toHaveBeenCalledOnce();
  expect(mocks.unmounts).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "播放全部" }));
  fireEvent.click(view.getByRole("button", { name: "加入队列" }));
  expect(input.onReplace).toHaveBeenCalledOnce();
  expect(input.onAddList).toHaveBeenCalledOnce();
});
it("supports existing callers without the optional replace callback by playing the first full-album track", async () => {
  const input = props();
  const view = render(<Album {...input} onReplace={undefined} />);
  await view.findByTestId("virtual-album-tracks");
  fireEvent.change(view.getByRole("textbox"), { target: { value: "Second" } });
  fireEvent.click(view.getByRole("button", { name: "播放全部" }));
  expect(input.onClick).toHaveBeenCalledExactlyOnceWith(fixture().tracks[0], 0);
});
it("ignores a late result for a replaced album and resets album-specific tab/search state", async () => {
  let resolve!: (value: ReturnType<typeof fixture>) => void;
  mocks.load
    .mockReturnValueOnce(new Promise((done) => (resolve = done)))
    .mockResolvedValueOnce(fixture(2));
  const input = props();
  const ref = { current: null as null | AlbumPageRef };
  const view = render(<Album {...input} ref={ref} />);
  view.rerender(<Album {...input} ref={ref} id={2} />);
  await view.findByTestId("virtual-album-tracks");
  await act(async () => resolve(fixture(1)));
  expect(ref.current?.album?.content.id).toBe(2);
  expect(view.getByRole("tab", { name: /歌曲/ })).toHaveAttribute("aria-selected", "true");
  expect(ref.current?.album?.tracks[0]?.id).toBe(21);
});
