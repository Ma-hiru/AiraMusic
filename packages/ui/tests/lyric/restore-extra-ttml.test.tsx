import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Lyric from "@mahiru/ui/wins/main/pages/player/lyric";

const mocks = vi.hoisted(() => ({
  excludeExtraTTML: vi.fn(),
  showToast: vi.fn(),
  player: {
    current: { track: { id: 41 }, lyric: null as Nullable<NeteaseLyricModel> },
    audio: Object.assign(new EventTarget(), { instance: { currentTime: 20 }, paused: true }),
    playing: false,
    reloadLyric: vi.fn()
  }
}));

vi.mock("@/wins/main/lib/handle", () => ({ default: { usePlayer: () => mocks.player } }));
vi.mock("@/wins/main/hooks/use-player-view-visible", () => ({ usePlayerViewVisible: () => true }));
vi.mock("@/common/hooks/use-window-visible", () => ({ useWindowVisible: () => true }));
vi.mock("@/common/hooks/use-tailwind-media-query", () => ({ useTailwindMediaQuery: () => ({}) }));
vi.mock("@/wins/main/hooks/use-page-jump", () => ({
  usePageJump: () => ({ jumpArtistPage: vi.fn() })
}));
vi.mock("@/common/store/settings", () => ({
  useSettings: () => ({ preference: { defaultUseDisplayWindow: false } })
}));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesLyric: { excludeExtraTTML: mocks.excludeExtraTTML }
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: mocks.showToast } }));
vi.mock("@/common/player/ui", () => ({
  default: { smoothScrollTo: async () => ({ status: "finished" }) }
}));
vi.mock("@/common/components/display/lyric/lyric-line", () => ({
  default: ({ line }: { line: LyricLine }) => <p>{line.words[0]?.word}</p>
}));

const supplemental: NeteaseLyricModel = {
  id: 41,
  isLocalTTML: true,
  tips: "补充库歌词",
  rmExisted: false,
  tlExisted: false,
  noteExisted: false,
  data: [
    {
      startTime: 1000,
      endTime: 2000,
      translatedLyric: "",
      romanLyric: "",
      words: [{ word: "最后一行", startTime: 1000, endTime: 2000 }]
    }
  ]
};

beforeEach(() => {
  mocks.player.current.lyric = supplemental;
  mocks.player.reloadLyric.mockReset();
  mocks.excludeExtraTTML.mockReset();
  mocks.showToast.mockClear();
});
afterEach(cleanup);

it("把恢复按钮放在来源提示后，先排除当前曲目再重新加载", async () => {
  const reload = Promise.withResolvers<void>();
  mocks.player.reloadLyric.mockReturnValue(reload.promise);
  const view = render(<Lyric />);
  const button = view.getByRole("button", { name: "恢复原始歌词" });
  expect(
    view.getByText("最后一行").compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(view.getByText("补充库歌词").nextElementSibling).toBe(button);

  fireEvent.click(button);
  expect(mocks.excludeExtraTTML).toHaveBeenCalledExactlyOnceWith(41);
  expect(mocks.player.reloadLyric).toHaveBeenCalledExactlyOnceWith();
  expect(mocks.excludeExtraTTML.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.player.reloadLyric.mock.invocationCallOrder[0]!
  );
  expect(button).toBeDisabled();

  await act(async () => {
    mocks.player.current.lyric = { ...supplemental, isLocalTTML: false };
    reload.resolve();
  });
  expect(view.queryByRole("button", { name: "恢复原始歌词" })).not.toBeInTheDocument();
});

it("恢复失败后继续展示原有歌词和可点击的恢复按钮", async () => {
  mocks.player.reloadLyric.mockRejectedValueOnce(new Error("歌词加载失败"));
  const view = render(<Lyric />);
  const button = view.getByRole("button", { name: "恢复原始歌词" });

  await act(async () => {
    fireEvent.click(button);
  });

  expect(view.getByText("最后一行")).toBeInTheDocument();
  expect(button).toHaveAccessibleName("恢复原始歌词");
  expect(button).toBeEnabled();
  expect(mocks.showToast).toHaveBeenCalledWith({ text: "恢复原始歌词失败", type: "error" });
});

it("上一首歌残留的补充歌词不提供恢复入口", () => {
  mocks.player.current.lyric = { ...supplemental, id: 40 };
  const view = render(<Lyric />);
  expect(view.queryByRole("button", { name: "恢复原始歌词" })).not.toBeInTheDocument();
});
