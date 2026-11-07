import { act, render, within, cleanup, fireEvent } from "@testing-library/react";
import { NeteaseArtist } from "@mahiru/ui/common/netease/models";
import Header from "@mahiru/ui/common/components/page/artist-v2/header";
import type { ComponentProps, ReactEventHandler } from "react";
import type { NeteaseTrackRecord } from "@mahiru/ui/common/netease/models";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  toggleLayout: vi.fn(),
  toast: vi.fn(),
  error: vi.fn()
}));

vi.mock("@/common/netease/api", () => ({ NeteaseAPIArtist: { subscribe: mocks.subscribe } }));
vi.mock("@/common/hooks/use-playlist-layout", () => ({
  usePlaylistLayout: () => ({ legacy: false, toggleLayout: mocks.toggleLayout })
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: mocks.toast } }));
vi.mock("@/common/lib/log", () => ({ Log: { error: mocks.error, warn: vi.fn() } }));
vi.mock("@/common/components/display/image/netease-image", () => ({
  default: ({
    className,
    onLoad,
    image,
    preview
  }: {
    preview?: boolean;
    className?: string;
    image?: { src: string; alt?: string };
    onLoad?: ReactEventHandler<HTMLImageElement>;
  }) => (
    <img
      className={className}
      src={image?.src}
      alt={image?.alt ?? ""}
      data-preview={String(preview)}
      onLoad={onLoad}
    />
  )
}));

type Props = ComponentProps<typeof Header>;
type ArtistData = ConstructorParameters<typeof NeteaseArtist>[0];

function artist(overrides: Partial<ArtistData> = {}) {
  return new NeteaseArtist({
    id: 111,
    name: "Test artist",
    detail: {
      blacklist: false,
      preferShow: 0,
      videoCount: 7,
      showPriMsg: false,
      identify: { imageUrl: null, actionUrl: "", imageDesc: "" },
      secondaryExpertIdentiy: [],
      artist: {
        id: 111,
        name: "Test artist",
        cover: "https://p1.music.126.net/cover.jpg",
        avatar: "https://p1.music.126.net/avatar.jpg",
        mvSize: 7,
        alias: ["Alias A", "Alias B"],
        albumSize: 5,
        briefDesc: "第一段歌手简介\n第二段完整介绍",
        identifyTag: null,
        musicSize: 42,
        identities: ["歌手", "作曲"],
        transNames: ["Translated name"],
        rank: { rank: 0, type: 0 }
      }
    },
    hotTracks: [{ id: 1 }] as NeteaseTrackRecord[],
    followInfos: {
      fansCnt: 100,
      follow: false,
      followCnt: 0,
      followDay: "",
      isFollow: false,
      followDayCnt: 0
    },
    desc: {
      count: 0,
      briefDesc: "完整简述",
      introduction: [{ ti: "歌手介绍", txt: "完整介绍正文" }]
    },
    ...overrides
  });
}

function props(entry = artist(), overrides: Partial<Props> = {}): Props {
  return {
    artist: entry,
    reload: vi.fn(),
    pageActionType: "out",
    onPageAction: vi.fn(),
    onPlayAll: vi.fn(),
    onAddList: vi.fn(),
    onShowIntro: vi.fn(),
    onAvatarLoaded: vi.fn(),
    children: <div data-testid="artist-content">歌手内容</div>,
    ...overrides
  };
}

function statValue(container: HTMLElement, label: string) {
  const title = [...container.querySelectorAll("dt")].find((el) => el.textContent === label)!;
  return title.nextElementSibling?.textContent;
}

function deferred() {
  let resolve!: (value: { code: number; message?: string }) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<{ code: number; message?: string }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscribe.mockResolvedValue({ code: 200 });
});
afterEach(cleanup);

it("shows artist identities, aliases and four readonly statistics beside the content", () => {
  const input = props();
  const { container, getByRole, getByText, getByTestId } = render(<Header {...input} />);
  const aside = container.querySelector("aside")!;

  expect(getByRole("heading", { level: 1, name: "Test artist" })).toBeInTheDocument();
  expect(within(aside).getByText("Alias A / Alias B")).toBeInTheDocument();
  expect(within(aside).getByText("Translated name")).toBeInTheDocument();
  expect(getByText("歌手")).toBeInTheDocument();
  expect(getByText("作曲")).toBeInTheDocument();
  expect([...aside.querySelectorAll("dt")].map((el) => el.textContent)).toEqual([
    "歌曲",
    "专辑",
    "MV",
    "粉丝"
  ]);
  expect(statValue(container, "歌曲")).toBe("42");
  expect(statValue(container, "专辑")).toBe("5");
  expect(statValue(container, "MV")).toBe("7");
  expect(statValue(container, "粉丝")).toBe("100");
  for (const el of aside.querySelectorAll("dt,dd")) expect(el.closest("button")).toBeNull();
  fireEvent.click(within(aside).getByText("粉丝"));
  expect(mocks.subscribe).not.toHaveBeenCalled();
  expect(getByTestId("artist-content")).toBeInTheDocument();
});

it("forwards avatar preview and loaded image while preserving existing page tools", () => {
  const input = props();
  const { getByRole } = render(<Header {...input} />);
  const image = getByRole("img", { name: "Test artist" }) as HTMLImageElement;
  expect(image).toHaveAttribute("data-preview", "true");
  expect(image.className).toContain("rounded-full");
  fireEvent.load(image);
  expect(input.onAvatarLoaded).toHaveBeenCalledExactlyOnceWith(image.src);

  fireEvent.click(getByRole("button", { name: "刷新" }));
  fireEvent.click(getByRole("button", { name: "独立窗口打开" }));
  fireEvent.click(getByRole("button", { name: "切换到简约版歌手" }));
  expect(input.reload).toHaveBeenCalledOnce();
  expect(input.onPageAction).toHaveBeenCalledOnce();
  expect(mocks.toggleLayout).toHaveBeenCalledOnce();
});

it("offers primary playback, outline queue/follow actions and the complete-introduction entry", () => {
  const input = props();
  const { getByRole } = render(<Header {...input} />);
  const play = getByRole("button", { name: "播放热门" });
  const queue = getByRole("button", { name: "加入队列" });
  const follow = getByRole("button", { name: "关注" });
  expect(play).toHaveClass("bg-primary", "text-primary-text", "hover:bg-primary-active");
  expect(queue).toHaveClass("border-white/20", "bg-white/5");
  expect(follow).toHaveClass("border-white/20", "bg-white/5");
  expect(follow.className).not.toMatch(/text-(?:primary|secondary)/);
  fireEvent.click(play);
  fireEvent.click(queue);
  fireEvent.click(getByRole("button", { name: "查看介绍" }));
  expect(input.onPlayAll).toHaveBeenCalledOnce();
  expect(input.onAddList).toHaveBeenCalledOnce();
  expect(input.onShowIntro).toHaveBeenCalledOnce();
});

it("preserves the original follow-day wording and updates fans only once optimistically", async () => {
  const entry = artist();
  entry.followInfos = { ...entry.followInfos, follow: true, followDay: "已关注 38天" };
  const request = deferred();
  mocks.subscribe.mockReturnValueOnce(request.promise);
  const { container, getByRole } = render(<Header {...props(entry)} />);
  const button = getByRole("button", { name: "已关注 (38天)" });

  act(() => {
    button.click();
    button.click();
  });
  expect(mocks.subscribe).toHaveBeenCalledExactlyOnceWith(111, false);
  expect(statValue(container, "粉丝")).toBe("99");
  expect(getByRole("button", { name: "关注" })).toBeDisabled();
  expect(getByRole("button", { name: "关注" })).toHaveAttribute("aria-busy", "true");
  expect(getByRole("button", { name: "关注" }).className).not.toMatch(/text-(?:primary|secondary)/);

  await act(async () => request.resolve({ code: 200 }));
  expect(statValue(container, "粉丝")).toBe("99");
  expect(getByRole("button", { name: "关注" })).toBeEnabled();
  expect(mocks.toast).toHaveBeenCalledExactlyOnceWith({ type: "success", text: "取消关注成功" });
});

it("rolls back the count, follow state and follow-day text if unfollowing fails", async () => {
  const entry = artist();
  entry.followInfos = { ...entry.followInfos, follow: true, followDay: "已关注 2年8天" };
  const request = deferred();
  mocks.subscribe.mockReturnValueOnce(request.promise);
  const { container, getByRole } = render(<Header {...props(entry)} />);
  fireEvent.click(getByRole("button", { name: "已关注 (2年8天)" }));
  expect(statValue(container, "粉丝")).toBe("99");

  await act(async () => request.reject(new Error("offline")));
  expect(statValue(container, "粉丝")).toBe("100");
  expect(getByRole("button", { name: "已关注 (2年8天)" })).toBeEnabled();
  expect(mocks.toast).toHaveBeenLastCalledWith({ type: "error", text: "取消关注失败，请重试" });
});

it("rolls back a failed follow request and handles an unsuccessful API response", async () => {
  const request = deferred();
  mocks.subscribe.mockReturnValueOnce(request.promise);
  const { container, getByRole } = render(<Header {...props()} />);
  fireEvent.click(getByRole("button", { name: "关注" }));
  expect(statValue(container, "粉丝")).toBe("101");
  expect(getByRole("button", { name: "已关注" })).toBeDisabled();
  await act(async () => request.resolve({ code: 500, message: "rejected" }));
  expect(statValue(container, "粉丝")).toBe("100");
  expect(getByRole("button", { name: "关注" })).toBeEnabled();
  expect(mocks.error).toHaveBeenCalledOnce();
});

it("ignores an old artist result without releasing or overwriting the new artist's request", async () => {
  const first = deferred();
  const second = deferred();
  mocks.subscribe.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const input = props();
  const { rerender, container, getByRole } = render(<Header {...input} />);
  fireEvent.click(getByRole("button", { name: "关注" }));

  const next = artist({ id: 222, name: "Next artist" });
  next.detail = { ...next.detail, artist: { ...next.detail.artist, id: 222, name: "Next artist" } };
  next.followInfos = { ...next.followInfos, fansCnt: 500, follow: true, followDay: "已关注12天" };
  rerender(<Header {...input} artist={next} />);
  expect(statValue(container, "粉丝")).toBe("500");
  fireEvent.click(getByRole("button", { name: "已关注 (12天)" }));
  expect(mocks.subscribe).toHaveBeenLastCalledWith(222, false);
  expect(statValue(container, "粉丝")).toBe("499");

  await act(async () => first.resolve({ code: 200 }));
  expect(statValue(container, "粉丝")).toBe("499");
  expect(getByRole("button", { name: "关注" })).toBeDisabled();
  expect(mocks.toast).not.toHaveBeenCalled();
  await act(async () => second.resolve({ code: 200 }));
  expect(statValue(container, "粉丝")).toBe("499");
  expect(getByRole("button", { name: "关注" })).toBeEnabled();
  expect(mocks.toast).toHaveBeenCalledOnce();
});

it("updates follow details when refreshed data for the same artist arrives", () => {
  const input = props();
  const { rerender, container, getByRole } = render(<Header {...input} />);
  const next = artist();
  next.followInfos = { ...next.followInfos, fansCnt: 200, follow: true, followDay: "已关注 1年" };
  rerender(<Header {...input} artist={next} />);
  expect(statValue(container, "粉丝")).toBe("200");
  expect(getByRole("button", { name: "已关注 (1年)" })).toHaveAttribute("aria-pressed", "true");
});

it("keeps the introduction button but omits the duplicate excerpt while viewing the introduction", () => {
  const input = props();
  const { container, getByRole } = render(<Header {...input} showIntro />);
  const aside = container.querySelector("aside")!;
  expect(within(aside).queryByText(/第一段歌手简介/)).toBeNull();
  expect(getByRole("button", { name: "正在查看介绍" })).toBeDisabled();
});

it("omits unavailable alias/identity/description fields without leaving fake placeholders", () => {
  const entry = artist();
  entry.detail.artist = {
    ...entry.detail.artist,
    alias: [],
    transNames: [],
    identities: [],
    briefDesc: ""
  };
  entry.desc = { count: 0, briefDesc: "", introduction: [] };
  const { container, queryByRole, queryByText, queryByLabelText } = render(
    <Header {...props(entry)} />
  );
  expect(container.querySelectorAll("dt")).toHaveLength(4);
  expect(queryByRole("button", { name: "查看介绍" })).toBeNull();
  expect(queryByLabelText("歌手身份")).toBeNull();
  expect(queryByText("暂无介绍")).toBeNull();
});

it("still links to a complete introduction when no short description is available", () => {
  const entry = artist();
  entry.detail.artist.briefDesc = "";
  entry.desc.briefDesc = "";
  const { container, getByRole } = render(<Header {...props(entry)} />);
  expect(getByRole("button", { name: "查看介绍" })).toBeInTheDocument();
  expect(
    within(container.querySelector("aside")!).queryByRole("heading", { name: "简介" })
  ).toBeNull();
});
