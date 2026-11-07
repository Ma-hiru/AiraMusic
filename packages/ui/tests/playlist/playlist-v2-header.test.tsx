import { act, render, within, cleanup, fireEvent } from "@testing-library/react";
import { NeteasePlaylist } from "@mahiru/ui/common/netease/models";
import { createPlaylistCoverModal } from "@mahiru/ui/common/components/display/modal/playlist-cover-modal";
import Top from "@mahiru/ui/common/components/page/playlist-v2/top";
import type { ComponentProps, ReactEventHandler } from "react";
import type { NeteaseUser } from "@mahiru/ui/common/netease/models";
import type {
  ListeningSong,
  ListeningRange,
  ListeningArtist
} from "@mahiru/ui/common/hooks/use-liked-listening";

const mocks = vi.hoisted(() => ({
  user: null as null | NeteaseUser,
  listening: {
    range: "week" as ListeningRange,
    songs: [] as ListeningSong[],
    artists: [] as ListeningArtist[],
    loading: false
  },
  setRange: vi.fn(),
  star: vi.fn(),
  invalidate: vi.fn(),
  createModal: vi.fn(),
  closeModal: vi.fn(),
  commentReady: vi.fn(),
  commentDeliver: vi.fn(),
  imageReady: vi.fn(),
  imageDeliver: vi.fn(),
  toggleLayout: vi.fn()
}));

vi.mock("@/common/store/user", () => ({ useUser: () => mocks.user }));
vi.mock("@/common/hooks/use-liked-listening", async () => {
  const { useState } = await import("react");
  return {
    useLikedListening: function useLikedListening() {
      const [range, setRange] = useState(mocks.listening.range);
      return {
        ...mocks.listening,
        range,
        setRange: (value: ListeningRange) => {
          mocks.setRange(value);
          setRange(value);
        }
      };
    }
  };
});
vi.mock("@/common/netease/api", () => ({ NeteaseAPIPlaylist: { star: mocks.star } }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesPlaylist: { invalidate: mocks.invalidate }
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    comment: { reactReadyAwait: mocks.commentReady },
    image: { reactReadyAwait: mocks.imageReady }
  }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: {
    comment: { deliver: mocks.commentDeliver },
    preview: { deliver: mocks.imageDeliver }
  }
}));
vi.mock("@/common/hooks/use-playlist-layout", () => ({
  usePlaylistLayout: () => ({ legacy: false, toggleLayout: mocks.toggleLayout })
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/components/display/modal", async () => ({
  default: {
    useModal: () => ({ create: mocks.createModal }),
    close: mocks.closeModal
  },
  createPlaylistCoverModal: (
    await import("@mahiru/ui/common/components/display/modal/playlist-cover-modal")
  ).createPlaylistCoverModal,
  createDialogModal: vi.fn(),
  createPlaylistEditModal: vi.fn()
}));
vi.mock("@/common/components/display/image/netease-image", () => ({
  default: ({
    className,
    onLoad,
    image
  }: {
    className?: string;
    image?: { src: string; alt?: string };
    onLoad?: ReactEventHandler<HTMLImageElement>;
  }) => <img className={className} src={image?.src} alt={image?.alt ?? ""} onLoad={onLoad} />
}));

type Props = ComponentProps<typeof Top>;
type PlaylistData = ConstructorParameters<typeof NeteasePlaylist>[0];

function playlist(overrides: Partial<PlaylistData> = {}) {
  return new NeteasePlaylist({
    id: 111,
    name: "Test playlist",
    description: "第一段简介\n第二段简介\n完整说明",
    coverImgUrl: "https://p1.music.126.net/cover.jpg",
    createTime: Date.UTC(2020, 0, 11),
    creator: {
      userId: 2,
      nickname: "Playlist creator",
      avatarUrl: "https://p1.music.126.net/avatar.jpg",
      signature: ""
    },
    highQuality: false,
    playCount: 12000,
    privacy: 0,
    subscribed: false,
    subscribedCount: 10,
    tags: ["日语", "ACG"],
    trackCount: 24,
    trackNumberUpdateTime: 0,
    trackUpdateTime: 0,
    updateTime: 0,
    userId: 2,
    shareCount: 3,
    commentCount: 4,
    playlistType: "UGC",
    trackIds: [],
    tracks: [],
    ...overrides
  });
}

function props(summary = playlist(), overrides: Partial<Props> = {}): Props {
  return {
    user: null,
    source: "normal",
    summary,
    loading: false,
    editable: false,
    pageActionType: "out",
    coverCacheKey: "cover-version",
    searchTracks: vi.fn(),
    reload: vi.fn(),
    onAddList: vi.fn(),
    onPlayAll: vi.fn(),
    onEdited: vi.fn(),
    onPageAction: vi.fn(),
    onToggleSelectionMode: vi.fn(),
    children: <div>歌曲区域</div>,
    ...overrides
  };
}

function statValue(container: HTMLElement, label: string) {
  const row = [...container.querySelectorAll("dl > div")].find(
    (item) => item.querySelector("dt")?.textContent === label
  );
  return row?.querySelector("dd")?.textContent;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
  mocks.listening = { range: "week", songs: [], artists: [], loading: false };
  mocks.star.mockResolvedValue({ code: 200 });
  mocks.commentReady.mockResolvedValue(undefined);
  mocks.imageReady.mockResolvedValue(undefined);
});

afterEach(cleanup);

it("shows compact liked totals and updates the duration when the complete collection changes", () => {
  const tracks = [
    {
      id: 1,
      dt: 60000,
      ar: [{ id: 10, name: "Artist" }],
      al: { id: 20, picUrl: "https://p1.music.126.net/album-20.jpg" }
    },
    {
      id: 2,
      dt: 120000,
      ar: [
        { id: 10, name: "Artist" },
        { id: 11, name: "Guest" }
      ],
      al: { id: 21, picUrl: "https://p1.music.126.net/album-21.jpg" }
    }
  ] as NeteasePlaylist["tracks"];
  const summary = playlist({ tracks, trackCount: 2 });
  mocks.user = {
    userId: summary.creator.userId,
    profile: { userId: summary.creator.userId },
    likedPlaylist: { id: summary.id },
    userPlaylists: []
  } as unknown as NeteaseUser;
  const data = props(summary, { user: mocks.user });
  const view = render(<Top {...data} />);
  const aside = view.container.querySelector("aside")!;

  expect(within(aside).getByText("2 首 · 3 分钟 · 2020.01 创建")).toBeInTheDocument();
  expect(aside.querySelector("dl")).toBeNull();
  expect(within(aside).queryByRole("heading", { name: "标签" })).not.toBeInTheDocument();
  expect(within(aside).queryByRole("heading", { name: "简介" })).not.toBeInTheDocument();
  expect(within(aside).queryByRole("heading", { name: "收藏概览" })).not.toBeInTheDocument();
  expect(within(aside).getByRole("heading", { name: "最近常听" })).toBeInTheDocument();

  view.rerender(
    <Top {...data} summary={playlist({ tracks: tracks.slice(0, 1), trackCount: 1 })} />
  );
  expect(within(aside).getByText("1 首 · 1 分钟 · 2020.01 创建")).toBeInTheDocument();
});

it("shows an empty liked summary and the correct listening placeholder for each range", () => {
  const summary = playlist({ tracks: [], trackCount: 0, tags: [], description: "" });
  mocks.user = {
    userId: 2,
    profile: { userId: 2 },
    likedPlaylist: { id: summary.id }
  } as NeteaseUser;
  const input = props(summary);
  const view = render(<Top {...input} />);
  const aside = view.container.querySelector("aside")!;

  expect(within(aside).getByText("0 首 · 0 分钟 · 2020.01 创建")).toBeInTheDocument();
  expect(within(aside).getByText("近一周暂无播放记录")).toBeInTheDocument();
  expect(within(aside).queryByRole("heading", { name: "最常听的歌手" })).not.toBeInTheDocument();
  expect(view.queryByText("暂无标签")).not.toBeInTheDocument();
  expect(view.queryByText("暂无简介")).not.toBeInTheDocument();

  fireEvent.click(within(aside).getByRole("button", { name: "全部" }));
  expect(mocks.setRange).toHaveBeenCalledExactlyOnceWith("all");
  expect(within(aside).getByRole("heading", { name: "最常听的歌曲" })).toBeInTheDocument();
  expect(within(aside).getByText("暂无播放记录")).toBeInTheDocument();
  expect(within(aside).getByRole("button", { name: "全部" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

it("forwards listening song locations and artist scopes through the current sidebar callbacks", () => {
  const summary = playlist();
  mocks.user = {
    userId: 2,
    profile: { userId: 2 },
    likedPlaylist: { id: summary.id }
  } as NeteaseUser;
  mocks.listening.songs = [
    {
      id: 7,
      name: "Listened song",
      artist: "Listening artist",
      album: "Record",
      cover: "https://p1.music.126.net/listened-song.jpg",
      playCount: 12
    }
  ];
  mocks.listening.artists = [{ id: 10, name: "Listening artist", playCount: 12, trackCount: 2 }];
  const input = props(summary, { onLocateSong: vi.fn(), onSelectScope: vi.fn() });
  const view = render(<Top {...input} />);
  const aside = view.container.querySelector("aside")!;

  fireEvent.click(
    within(aside).getByTitle("Listened song · Listening artist · Record · 12 次 · 在列表中定位")
  );
  expect(input.onLocateSong).toHaveBeenCalledExactlyOnceWith(7);
  fireEvent.click(within(aside).getByTitle("Listening artist · 12 次 · 2 首"));
  expect(input.onSelectScope).toHaveBeenCalledExactlyOnceWith({ kind: "artist", key: "id:10" });
  expect(input.onPlayAll).not.toHaveBeenCalled();
  expect(input.onAddList).not.toHaveBeenCalled();
});

it("keeps all six sidebar statistics read-only and exposes playback actions separately", () => {
  const data = props();
  const { container, getByRole, getByText } = render(<Top {...data} />);
  const aside = container.querySelector("aside")!;

  expect([...aside.querySelectorAll("dt")].map((item) => item.textContent)).toEqual([
    "歌曲",
    "播放",
    "创建",
    "评论",
    "分享",
    "收藏"
  ]);
  expect(aside.querySelector("dl button, dl a, dl [role=button]")).toBeNull();
  for (const item of aside.querySelectorAll("dl > div")) fireEvent.click(item);
  expect(data.onPlayAll).not.toHaveBeenCalled();
  expect(data.onAddList).not.toHaveBeenCalled();
  expect(mocks.star).not.toHaveBeenCalled();
  expect(mocks.commentReady).not.toHaveBeenCalled();

  const content = getByText("歌曲区域").parentElement!;
  expect(within(content).queryByRole("button", { name: "详情" })).toBeNull();
  const playAll = getByRole("button", { name: "播放全部" });
  expect(playAll).toHaveClass("bg-primary");
  fireEvent.click(playAll);
  fireEvent.click(getByRole("button", { name: "加入队列" }));
  expect(data.onPlayAll).toHaveBeenCalledTimes(1);
  expect(data.onAddList).toHaveBeenCalledTimes(1);
});

it("reuses the original detail modal from the cover and the sidebar description toggle", () => {
  const data = props();
  const { getByRole } = render(<Top {...data} />);

  fireEvent.click(getByRole("button", { name: "查看歌单详情" }));
  fireEvent.click(getByRole("button", { name: "展开" }));
  expect(mocks.createModal).toHaveBeenCalledTimes(2);
  for (const call of mocks.createModal.mock.calls) {
    expect(call).toEqual([
      createPlaylistCoverModal,
      { playlist: data.summary, coverCacheKey: "cover-version" }
    ]);
  }
});

it("forwards the loaded cover URL to the existing page callback", () => {
  const onCoverLoaded = vi.fn();
  const { getByRole } = render(<Top {...props(playlist(), { onCoverLoaded })} />);
  const image = getByRole("button", { name: "查看歌单详情" }).querySelector("img")!;

  fireEvent.load(image);
  expect(onCoverLoaded).toHaveBeenCalledWith(image.src);
});

it("keeps the description section with a placeholder when the description is empty", () => {
  const { container, getByRole, getByText, queryByRole } = render(
    <Top {...props(playlist({ description: "" }))} />
  );

  expect(queryByRole("button", { name: "展开" })).toBeNull();
  expect(getByText("简介")).toBeInTheDocument();
  expect(getByText("暂无简介")).toBeInTheDocument();
  expect(container.querySelectorAll("aside dt")).toHaveLength(6);
  fireEvent.click(getByRole("button", { name: "查看歌单详情" }));
  expect(mocks.createModal).toHaveBeenCalledTimes(1);
});

it.each(["created", "liked"] as const)(
  "does not offer to subscribe to a user's %s playlist",
  (kind) => {
    const summary = playlist();
    const user = {
      likedPlaylist: { id: kind === "liked" ? summary.id : 999 },
      userPlaylists: kind === "created" ? [{ id: summary.id }] : []
    } as unknown as NeteaseUser;
    const { queryByRole } = render(
      <Top {...props(summary, { user, source: kind === "liked" ? "like" : "normal" })} />
    );

    expect(queryByRole("button", { name: "收藏" })).toBeNull();
    expect(queryByRole("button", { name: "已收藏" })).toBeNull();
  }
);

it("updates subscription state and sidebar counts only after the existing API request completes", async () => {
  const request = deferred();
  mocks.star.mockReturnValueOnce(request.promise);
  const data = props();
  const { container, getByRole } = render(<Top {...data} />);

  fireEvent.click(getByRole("button", { name: "收藏" }));
  expect(mocks.star).toHaveBeenCalledWith({ id: 111, t: 1 });
  expect(statValue(container, "收藏")).toBe("10");
  expect(mocks.invalidate).not.toHaveBeenCalled();
  expect(data.onEdited).not.toHaveBeenCalled();

  await act(async () => request.resolve());
  expect(getByRole("button", { name: "已收藏" })).toHaveAttribute("aria-pressed", "true");
  expect(statValue(container, "收藏")).toBe("11");
  expect(mocks.invalidate).toHaveBeenCalledWith(111);
  expect(data.onEdited).toHaveBeenCalledWith(["star"]);

  await act(async () => fireEvent.click(getByRole("button", { name: "已收藏" })));
  expect(mocks.star).toHaveBeenLastCalledWith({ id: 111, t: 2 });
  expect(statValue(container, "收藏")).toBe("10");
  expect(getByRole("button", { name: "收藏" })).toHaveAttribute("aria-pressed", "false");
});

it("does not apply a pending subscription result to a different playlist", async () => {
  const request = deferred();
  mocks.star.mockReturnValueOnce(request.promise);
  const data = props();
  const { rerender, container, getByRole } = render(<Top {...data} />);

  fireEvent.click(getByRole("button", { name: "收藏" }));
  rerender(<Top {...data} summary={playlist({ id: 222, subscribedCount: 50 })} />);
  await act(async () => request.resolve());

  expect(statValue(container, "收藏")).toBe("50");
  expect(getByRole("button", { name: "收藏" })).toHaveAttribute("aria-pressed", "false");
});

it("waits for the existing comments window before sending its playlist IPC message", async () => {
  const ready = deferred();
  mocks.commentReady.mockReturnValueOnce(ready.promise);
  const { getByRole } = render(<Top {...props()} />);

  fireEvent.click(getByRole("button", { name: "查看评论" }));
  expect(mocks.commentReady).toHaveBeenCalledTimes(1);
  expect(mocks.commentDeliver).not.toHaveBeenCalled();
  await act(async () => ready.resolve());
  expect(mocks.commentDeliver).toHaveBeenCalledWith({ id: 111, type: "playlist" });
});

it("keeps original page tools and connects the new layout switch to the shared hook", () => {
  const data = props();
  const { getByRole } = render(<Top {...data} />);

  fireEvent.click(getByRole("button", { name: "选择" }));
  fireEvent.click(getByRole("button", { name: "刷新" }));
  fireEvent.click(getByRole("button", { name: "独立窗口打开" }));
  fireEvent.click(getByRole("button", { name: "切换到简约版歌单" }));
  expect(data.onToggleSelectionMode).toHaveBeenCalledTimes(1);
  expect(data.reload).toHaveBeenCalledTimes(1);
  expect(data.onPageAction).toHaveBeenCalledTimes(1);
  expect(mocks.toggleLayout).toHaveBeenCalledTimes(1);
});

it("renders full detail content and preserves the original image-window handoff", async () => {
  const summary = playlist();
  const modal = createPlaylistCoverModal({ playlist: summary, coverCacheKey: "cover-version" });
  const { getByText, getByTitle } = render(<>{modal.content}</>);

  expect(modal.title).toBe("歌单详情");
  expect(modal.width).toBe(900);
  for (const label of ["歌曲", "播放", "创建", "评论", "分享", "收藏"]) {
    expect(getByText(label)).toBeInTheDocument();
  }
  expect(getByText(/第一段简介/).textContent).toBe(summary.description);
  const ready = deferred();
  mocks.imageReady.mockReturnValueOnce(ready.promise);
  fireEvent.click(getByTitle("查看封面"));
  expect(mocks.imageReady).toHaveBeenCalledTimes(1);
  expect(mocks.imageDeliver).not.toHaveBeenCalled();
  await act(async () => ready.resolve());
  expect(mocks.imageDeliver).toHaveBeenCalledWith({
    url: summary.coverImgUrl,
    alt: summary.name
  });
});
