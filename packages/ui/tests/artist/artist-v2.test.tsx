import { act, render, within, cleanup, waitFor, fireEvent } from "@testing-library/react";
import Artist from "@mahiru/ui/common/components/page/artist-v2";
import Introduction from "@mahiru/ui/common/components/page/artist-v2/introduction";
import type { Ref, ReactNode, ComponentProps } from "react";
import type { NeteaseArtist } from "@mahiru/ui/common/netease/models";
import type { ArtistRef } from "@mahiru/ui/common/components/page/artist-v2";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  menu: vi.fn(),
  albumRequest: vi.fn(),
  similarRequest: vi.fn(),
  trackMounts: vi.fn(),
  trackUnmounts: vi.fn(),
  trackProps: vi.fn(),
  trackHandle: { scrollToItem: vi.fn() }
}));

vi.mock("@/common/netease/services", () => ({ NeteaseServicesArtist: { id: mocks.load } }));
vi.mock("@/common/lib/log", () => ({ Log: { info: vi.fn() } }));
vi.mock("@/common/lib/net", () => ({ RendererNet: {} }));
vi.mock("@/common/hooks/use-online", () => ({ useOnline: () => ({ online: true }) }));
vi.mock("@/common/hooks/use-agent-focus-ctx", () => ({ useAgentFocusCtx: vi.fn() }));
vi.mock("@/common/hooks/use-track-context-menu", () => ({
  useTrackContextMenu: (options: unknown) => {
    mocks.menu(options);
    return { onContextMenu: vi.fn() };
  }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/data-input/search", () => ({
  default: ({
    setIsTyping,
    onSearch,
    onValueChange,
    value,
    placeholder
  }: {
    value: string;
    placeholder: string;
    onSearch: (query: string) => void;
    onValueChange: (query: string) => void;
    setIsTyping: (typing: boolean) => void;
  }) => (
    <input
      value={value}
      aria-label={placeholder}
      placeholder={placeholder}
      onBlur={() => setIsTyping(false)}
      onFocus={() => setIsTyping(true)}
      onChange={(event) => {
        onValueChange(event.target.value);
        onSearch(event.target.value);
      }}
    />
  )
}));
vi.mock("@/common/components/page/artist-v2/header", () => ({
  default: ({
    onAddList,
    onPlayAll,
    onShowIntro,
    onPageAction,
    onAvatarLoaded,
    reload,
    children
  }: {
    reload: () => void;
    children: ReactNode;
    onPlayAll: () => void;
    onAddList?: () => void;
    onShowIntro: () => void;
    onPageAction: () => void;
    onAvatarLoaded?: (url: string) => void;
  }) => (
    <div>
      <button onClick={onPlayAll}>播放热门</button>
      <button onClick={onAddList}>加入队列</button>
      <button onClick={onPageAction}>窗口操作</button>
      <button onClick={() => onAvatarLoaded?.("avatar-url")}>模拟头像加载</button>
      <button onClick={onShowIntro}>查看介绍</button>
      <button onClick={reload}>刷新</button>
      {children}
    </div>
  )
}));
vi.mock("@/common/components/page/artist-v2/album", async () => {
  const { useEffect } = await import("react");
  return {
    default: function AlbumListMock({
      id,
      onClick,
      keyword
    }: {
      id: number;
      keyword: string;
      onClick: (id: number) => void;
    }) {
      useEffect(() => {
        mocks.albumRequest(id);
      }, [id]);
      return (
        <button data-keyword={keyword} data-testid="artist-albums" onClick={() => onClick(99)}>
          打开专辑
        </button>
      );
    }
  };
});
vi.mock("@/common/components/page/artist-v2/similar-artists", async () => {
  const { useEffect } = await import("react");
  return {
    default: function SimilarArtistsMock({
      id,
      onClick
    }: {
      id: number;
      onClick: (id: number) => void;
    }) {
      useEffect(() => {
        mocks.similarRequest(id);
      }, [id]);
      return <button onClick={() => onClick(88)}>打开相似歌手</button>;
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
      ...props
    }: {
      ref: Ref<unknown>;
      tracks: NeteaseArtist["hotTracks"];
      onClick: (track: NeteaseArtist["hotTracks"][number], index: number) => void;
    }) {
      mocks.trackProps(props);
      useImperativeHandle(ref, () => mocks.trackHandle, []);
      useEffect(() => {
        mocks.trackMounts();
        return mocks.trackUnmounts;
      }, []);
      return (
        <div data-testid="virtual-artist-tracks">
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

type Props = ComponentProps<typeof Artist>;

function fixture(id = 1): NeteaseArtist {
  const tracks = [
    {
      id: id * 10 + 1,
      name: "First song",
      al: { id: 100, name: "Opening Album" },
      ar: [{ id: 7, name: "Primary Singer" }],
      alia: ["Sunrise"],
      tns: ["晨光"]
    },
    {
      id: id * 10 + 2,
      name: "Second song",
      al: { id: 200, name: "Blue Record" },
      ar: [{ id: 8, name: "Guest Vocalist" }],
      alia: ["Finale"],
      tns: ["Ending"]
    },
    {
      id: id * 10 + 3,
      name: "Third song",
      al: { id: 300, name: "Night Album" },
      ar: [{ id: 7, name: "Primary Singer" }],
      alia: [],
      tns: []
    }
  ];
  return {
    id,
    name: `Artist ${id}`,
    detail: { artist: { id, name: `Artist ${id}`, albumSize: 45, briefDesc: "Short description" } },
    desc: {
      briefDesc: "完整简介第一段\n完整简介第二段",
      introduction: [{ ti: "演艺经历", txt: "真实分节内容\n第二行" }]
    },
    hotTracks: tracks.map((detail) => ({
      id: detail.id,
      name: detail.name,
      sourceID: id,
      sourceName: "other",
      detail
    })),
    followInfos: { follow: false, fansCnt: 100, followDay: "" }
  } as NeteaseArtist;
}

function props(): Props {
  return {
    id: 1,
    routerActive: true,
    activeTrackID: 12,
    pageActionType: "out",
    heartManager: undefined,
    playableManager: undefined,
    addToPlaylistLast: vi.fn(),
    addToPlaylistNext: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    openComment: vi.fn(),
    onPageAction: vi.fn(),
    onClickAlbum: vi.fn(),
    onClickArtist: vi.fn(),
    onAvatarLoaded: vi.fn(),
    onClick: vi.fn(),
    onDataLoaded: vi.fn(),
    onLoadedData: vi.fn(),
    onReplace: vi.fn(),
    onAddList: vi.fn(),
    setIsTyping: vi.fn()
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue(fixture());
});
afterEach(cleanup);

it("preserves the full artist/ref and original playback, context, window and avatar callbacks", async () => {
  const input = props();
  const ref = { current: null as null | ArtistRef };
  const view = render(<Artist {...input} ref={ref} />);
  await view.findByTestId("virtual-artist-tracks");

  expect(mocks.load).toHaveBeenCalledExactlyOnceWith(1);
  expect(ref.current?.artist).toEqual(fixture());
  expect(ref.current?.trackListRef).toBe(mocks.trackHandle);
  await waitFor(() => {
    expect(input.onDataLoaded).toHaveBeenCalledExactlyOnceWith(ref.current?.artist);
    expect(input.onLoadedData).toHaveBeenCalledExactlyOnceWith(ref.current?.artist);
  });
  fireEvent.click(view.getByRole("button", { name: "Second song" }));
  expect(input.onClick).toHaveBeenCalledExactlyOnceWith(fixture().hotTracks[1], 1);
  expect(mocks.menu).toHaveBeenCalledWith(
    expect.objectContaining({
      addToPlaylistLast: input.addToPlaylistLast,
      addToPlaylistNext: input.addToPlaylistNext,
      addTrackToPlaylist: input.addTrackToPlaylist,
      openComment: input.openComment,
      onClickAlbum: input.onClickAlbum,
      onClickArtist: input.onClickArtist,
      onPlay: input.onClick
    })
  );
  expect(mocks.trackProps).toHaveBeenCalledWith(
    expect.objectContaining({
      activeID: 12,
      heartManager: input.heartManager,
      playableManager: input.playableManager
    })
  );
  fireEvent.click(view.getByRole("button", { name: "播放热门" }));
  fireEvent.click(view.getByRole("button", { name: "加入队列" }));
  fireEvent.click(view.getByRole("button", { name: "窗口操作" }));
  fireEvent.click(view.getByRole("button", { name: "模拟头像加载" }));
  expect(input.onReplace).toHaveBeenCalledOnce();
  expect(input.onAddList).toHaveBeenCalledOnce();
  expect(input.onPageAction).toHaveBeenCalledOnce();
  expect(input.onAvatarLoaded).toHaveBeenCalledExactlyOnceWith("avatar-url");
});

it("offers four tabs with correct counts, lazily mounts remote lists and keeps virtual tracks/ref mounted", async () => {
  const input = props();
  const ref = { current: null as null | ArtistRef };
  const view = render(<Artist {...input} ref={ref} />);
  await view.findByTestId("virtual-artist-tracks");

  expect(view.getAllByRole("tab")).toHaveLength(4);
  expect(view.getByRole("tab", { name: /热门歌曲\s*3/ })).toHaveAttribute("aria-selected", "true");
  expect(view.getByRole("tab", { name: /专辑\s*45/ })).toBeInTheDocument();
  expect(mocks.albumRequest).not.toHaveBeenCalled();
  expect(mocks.similarRequest).not.toHaveBeenCalled();

  fireEvent.click(view.getByRole("tab", { name: /专辑/ }));
  fireEvent.click(await view.findByRole("button", { name: "打开专辑" }));
  expect(mocks.albumRequest).toHaveBeenCalledExactlyOnceWith(1);
  expect(input.onClickAlbum).toHaveBeenCalledExactlyOnceWith(99);
  expect(mocks.similarRequest).not.toHaveBeenCalled();
  expect(view.getByTestId("virtual-artist-tracks").closest('[role="tabpanel"]')).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  expect(ref.current?.trackListRef).toBe(mocks.trackHandle);

  fireEvent.click(view.getByRole("tab", { name: "介绍" }));
  expect(view.getByRole("heading", { name: "演艺经历" })).toBeInTheDocument();
  fireEvent.click(view.getByRole("tab", { name: "相似歌手" }));
  fireEvent.click(await view.findByRole("button", { name: "打开相似歌手" }));
  expect(mocks.similarRequest).toHaveBeenCalledExactlyOnceWith(1);
  expect(input.onClickArtist).toHaveBeenCalledExactlyOnceWith(88);
  fireEvent.click(view.getByRole("tab", { name: /热门歌曲/ }));
  expect(view.getByRole("button", { name: "First song" })).toBeInTheDocument();
  expect(mocks.trackMounts).toHaveBeenCalledOnce();
  expect(mocks.trackUnmounts).not.toHaveBeenCalled();
  expect(ref.current?.trackListRef).toBe(mocks.trackHandle);
});

it("keeps one controlled search input, resets it on tabs and routes album search separately", async () => {
  const input = props();
  const view = render(<Artist {...input} />);
  await view.findByTestId("virtual-artist-tracks");
  const search = view.getByRole("textbox", { name: "搜索热门歌曲" });

  fireEvent.focus(search);
  expect(input.setIsTyping).toHaveBeenLastCalledWith(true);
  fireEvent.change(search, { target: { value: "Ending" } });
  expect(search).toHaveValue("Ending");
  fireEvent.blur(search);
  expect(input.setIsTyping).toHaveBeenLastCalledWith(false);
  fireEvent.click(view.getByRole("tab", { name: /专辑/ }));
  expect(view.getByRole("textbox", { name: "筛选已加载专辑" })).toBe(search);
  expect(search).toHaveValue("");
  fireEvent.change(search, { target: { value: "Album query" } });
  expect(view.getByTestId("artist-albums")).toHaveAttribute("data-keyword", "Album query");
  fireEvent.click(view.getByRole("tab", { name: "介绍" }));
  expect(search.closest("[inert]")).not.toBeNull();
  expect(view.container.querySelectorAll("input")).toHaveLength(1);
  expect(search).toHaveValue("");
  fireEvent.click(view.getByRole("tab", { name: /热门歌曲/ }));
  expect(view.getByRole("textbox", { name: "搜索热门歌曲" })).toBe(search);
  expect(search).toHaveValue("");
  expect(within(view.getByTestId("virtual-artist-tracks")).getAllByRole("button")).toHaveLength(3);
});

it.each(["sEcOnD", "blue record", "guest vocalist", "FINALE", "ending"])(
  "uses the real WASM index to search the complete hot-track fields: %s",
  async (keyword) => {
    const ref = { current: null as null | ArtistRef };
    const view = render(<Artist {...props()} ref={ref} />);
    await view.findByTestId("virtual-artist-tracks");

    fireEvent.change(view.getByRole("textbox"), { target: { value: keyword } });
    await waitFor(() => {
      const tracks = within(view.getByTestId("virtual-artist-tracks"));
      expect(tracks.getAllByRole("button")).toHaveLength(1);
      expect(tracks.getByRole("button", { name: "Second song" })).toBeInTheDocument();
    });
    expect(ref.current?.artist?.hotTracks).toHaveLength(3);
  }
);

it("preserves legacy callers by playing the first full hot track when onReplace is omitted", async () => {
  const input = props();
  const view = render(<Artist {...input} onReplace={undefined} />);
  await view.findByTestId("virtual-artist-tracks");
  fireEvent.change(view.getByRole("textbox"), { target: { value: "Ending" } });
  fireEvent.click(view.getByRole("button", { name: "播放热门" }));
  expect(input.onClick).toHaveBeenCalledExactlyOnceWith(fixture().hotTracks[0], 0);
});

it("renders complete introduction sections, falls back to the brief description and handles missing text", () => {
  const data = fixture();
  const view = render(<Introduction artist={data} />);
  expect(view.getByText(data.desc.briefDesc, { normalizer: (text) => text })).toBeInTheDocument();
  expect(view.getByRole("heading", { name: "演艺经历" })).toBeInTheDocument();
  expect(
    view.getByText(data.desc.introduction[0]!.txt, { normalizer: (text) => text })
  ).toBeInTheDocument();
  view.rerender(
    <Introduction artist={{ ...data, desc: { ...data.desc, briefDesc: "", introduction: [] } }} />
  );
  expect(view.getByText("Short description")).toBeInTheDocument();
  view.rerender(<Introduction artist={null} />);
  expect(view.getByText("暂无歌手介绍")).toBeInTheDocument();
});

it("ignores a late artist result and clears artist-specific tab/search state when the ID changes", async () => {
  let resolve!: (artist: NeteaseArtist) => void;
  mocks.load
    .mockReturnValueOnce(new Promise<NeteaseArtist>((done) => (resolve = done)))
    .mockResolvedValueOnce(fixture(2));
  const input = props();
  const ref = { current: null as null | ArtistRef };
  const view = render(<Artist {...input} ref={ref} />);
  view.rerender(<Artist {...input} ref={ref} id={2} />);
  await view.findByTestId("virtual-artist-tracks");
  await act(async () => resolve(fixture(1)));
  expect(ref.current?.artist?.id).toBe(2);
  expect(ref.current?.artist?.hotTracks[0]?.id).toBe(21);
  expect(view.getByRole("tab", { name: /热门歌曲/ })).toHaveAttribute("aria-selected", "true");
  expect(view.getByRole("textbox")).toHaveValue("");
});
