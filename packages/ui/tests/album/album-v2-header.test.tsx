import { act, render, within, cleanup, fireEvent } from "@testing-library/react";
import { NeteaseImageSize } from "@mahiru/ui/common/enum";
import { NeteaseAlbum } from "@mahiru/ui/common/netease/models";
import { createAlbumCoverModal } from "@mahiru/ui/common/components/display/modal/playlist-cover-modal";
import Top from "@mahiru/ui/common/components/page/album-v2/top";
import type { ComponentProps, ReactEventHandler } from "react";

const mocks = vi.hoisted(() => ({
  star: vi.fn(),
  createModal: vi.fn(),
  commentReady: vi.fn(),
  commentDeliver: vi.fn(),
  imageReady: vi.fn(),
  imageDeliver: vi.fn(),
  toggleLayout: vi.fn()
}));
vi.mock("@/common/netease/api", () => ({ NeteaseAPIAlbum: { star: mocks.star } }));
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
  default: { useModal: () => ({ create: mocks.createModal }) },
  createAlbumCoverModal: (
    await import("@mahiru/ui/common/components/display/modal/playlist-cover-modal")
  ).createAlbumCoverModal
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
type AlbumContent = NonNullable<Props["album"]>["content"];
type AlbumDynamic = NonNullable<Props["dynamic"]>;
function album(id = 1, overrides: Partial<AlbumContent> = {}) {
  const artist = { id: 7, name: "Artist", picUrl: "https://p1.music.126.net/artist.jpg" };
  return new NeteaseAlbum({
    content: {
      id,
      name: `Album ${id}`,
      picUrl: "https://p1.music.126.net/album.jpg",
      publishTime: Date.UTC(2020, 0, 11),
      artist,
      artists: [artist, { ...artist, id: 8, name: "Guest" }],
      type: "专辑",
      subType: "录音室版",
      tags: "ACG",
      company: "Record company",
      description: "第一段简介\n第二段简介\n完整说明",
      ...overrides
    } as AlbumContent,
    tracks: [{ id: 501 }] as NeteaseAlbum["tracks"]
  });
}
function dynamic(overrides: Partial<AlbumDynamic> = {}): AlbumDynamic {
  return {
    code: 200,
    isSub: false,
    subCount: 10,
    commentCount: 4,
    shareCount: 3,
    ...overrides
  } as AlbumDynamic;
}
function props(overrides: Partial<Props> = {}): Props {
  return {
    album: album(),
    dynamic: dynamic(),
    user: null,
    coverSize: NeteaseImageSize.lg,
    coverCacheKey: "version",
    pageActionType: "out",
    reload: vi.fn(),
    onAddList: vi.fn(),
    onPlayAll: vi.fn(),
    onEdited: vi.fn(),
    onPageAction: vi.fn(),
    children: <div>歌曲区域</div>,
    ...overrides
  };
}
function stat(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("aside dl > div")]
    .find((el) => el.querySelector("dt")?.textContent === label)
    ?.querySelector("dd")?.textContent;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.star.mockResolvedValue({ code: 200 });
  mocks.commentReady.mockResolvedValue(undefined);
  mocks.imageReady.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("adapts album fields and synchronizes the current playlist sidebar and button styles", () => {
  const input = props();
  const view = render(<Top {...input} />);
  const aside = view.container.querySelector("aside")!;
  expect([...aside.querySelectorAll("dt")].map((el) => el.textContent)).toEqual([
    "歌曲",
    "发行",
    "评论",
    "分享",
    "收藏"
  ]);
  expect(aside.querySelector("dl button, dl a, dl [role=button]")).toBeNull();
  expect(view.getByText("Guest / Artist")).toBeInTheDocument();
  expect(view.getByText("Record company")).toBeInTheDocument();
  expect(aside).toHaveClass("border-r", "[scrollbar-gutter:stable]");
  expect(aside.querySelector("dl")).toHaveClass("sm:grid-cols-3");
  expect(within(aside).getByRole("heading", { name: "标签" })).toBeInTheDocument();
  expect(view.getByRole("button", { name: "播放全部" })).toHaveClass(
    "bg-primary",
    "px-1.5",
    "py-0.5"
  );
  const content = view.getByText("歌曲区域").parentElement!;
  expect(within(content).queryByRole("button", { name: "详情" })).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "播放全部" }));
  fireEvent.click(view.getByRole("button", { name: "加入队列" }));
  expect(input.onPlayAll).toHaveBeenCalledOnce();
  expect(input.onAddList).toHaveBeenCalledOnce();
});
it("reuses the original album details from the cover and description, preserving its cache key", () => {
  const input = props();
  const view = render(<Top {...input} />);
  fireEvent.click(view.getByRole("button", { name: "查看专辑详情" }));
  fireEvent.click(view.getByRole("button", { name: "展开" }));
  expect(mocks.createModal).toHaveBeenCalledTimes(2);
  for (const call of mocks.createModal.mock.calls)
    expect(call).toEqual([
      createAlbumCoverModal,
      {
        album: input.album,
        dynamic: input.dynamic,
        coverCacheKey: `version${input.album!.content.publishTime}501`
      }
    ]);
});
it("uses the playlist placeholder treatment when album tags and description are empty", () => {
  const view = render(
    <Top
      {...props({
        album: album(1, { description: "  ", tags: "", type: "", subType: "", company: "" })
      })}
    />
  );
  expect(view.getByText("暂无标签")).toBeInTheDocument();
  expect(view.getByText("暂无简介")).toBeInTheDocument();
  expect(view.queryByRole("button", { name: "展开" })).not.toBeInTheDocument();
});
it("uses album subscription parameters and synchronizes local counts and refreshed dynamic props", async () => {
  const input = props();
  const view = render(<Top {...input} />);
  await act(async () => fireEvent.click(view.getByRole("button", { name: "收藏" })));
  expect(mocks.star).toHaveBeenLastCalledWith({ id: 1, t: 1 });
  expect(stat(view.container, "收藏")).toBe("11");
  expect(input.onEdited).toHaveBeenCalledOnce();
  await act(async () => fireEvent.click(view.getByRole("button", { name: "已收藏" })));
  expect(mocks.star).toHaveBeenLastCalledWith({ id: 1, t: 0 });
  expect(stat(view.container, "收藏")).toBe("10");
  view.rerender(<Top {...input} dynamic={dynamic({ isSub: true, subCount: 30 })} />);
  expect(view.getByRole("button", { name: "已收藏" })).toHaveAttribute("aria-pressed", "true");
  expect(stat(view.container, "收藏")).toBe("30");
});
it("does not apply a pending subscription response to another album", async () => {
  let resolve!: () => void;
  mocks.star.mockReturnValue(new Promise<void>((done) => (resolve = done)));
  const input = props();
  const view = render(<Top {...input} />);
  fireEvent.click(view.getByRole("button", { name: "收藏" }));
  view.rerender(<Top {...input} album={album(2)} dynamic={dynamic({ subCount: 20 })} />);
  await act(async () => resolve());
  expect(stat(view.container, "收藏")).toBe("20");
  expect(input.onEdited).not.toHaveBeenCalled();
});
it("opens album comments after the existing comment window becomes ready", async () => {
  let resolve!: () => void;
  mocks.commentReady.mockReturnValue(new Promise<void>((done) => (resolve = done)));
  const view = render(<Top {...props()} />);
  fireEvent.click(view.getByRole("button", { name: "查看评论" }));
  expect(mocks.commentDeliver).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(mocks.commentDeliver).toHaveBeenCalledExactlyOnceWith({ id: 1, type: "album" });
});
it("retains refresh, window and the existing shared layout toggle", () => {
  const input = props();
  const view = render(<Top {...input} />);
  fireEvent.click(view.getByRole("button", { name: "刷新" }));
  fireEvent.click(view.getByRole("button", { name: "独立窗口打开" }));
  fireEvent.click(view.getByRole("button", { name: "切换到简约版专辑" }));
  expect(input.reload).toHaveBeenCalledOnce();
  expect(input.onPageAction).toHaveBeenCalledOnce();
  expect(mocks.toggleLayout).toHaveBeenCalledOnce();
});
it("renders full album metadata and forwards raw cover viewing to the image window", async () => {
  const value = album();
  const modal = createAlbumCoverModal({
    album: value,
    dynamic: dynamic(),
    coverCacheKey: "version"
  });
  const view = render(modal.content);
  expect(modal.title).toBe("专辑详情");
  expect(modal.width).toBe(900);
  expect(
    view.getByText(value.content.description, { normalizer: (text) => text })
  ).toBeInTheDocument();
  for (const label of ["歌曲", "发行", "评论", "分享", "收藏"]) {
    expect(view.getByText(label)).toBeInTheDocument();
  }
  expect(view.queryByText("创建")).not.toBeInTheDocument();
  await act(async () => fireEvent.click(view.getByTitle("查看封面")));
  expect(mocks.imageReady).toHaveBeenCalledOnce();
  expect(mocks.imageDeliver).toHaveBeenCalledWith(
    expect.objectContaining({ alt: value.content.name, url: expect.stringContaining("album.jpg") })
  );
});
