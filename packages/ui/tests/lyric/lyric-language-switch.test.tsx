import { render, screen, fireEvent } from "@testing-library/react";
import { NeteaseLyric } from "@mahiru/ui/common/netease/models/netease-lyric";
import RendererPlayer from "@mahiru/ui/common/player/core";
import LyricChange from "@mahiru/ui/wins/main/pages/player/lyric-change";

const state = vi.hoisted(() => ({ player: null as null | RendererPlayer }));
vi.mock("@/wins/main/lib/handle", () => ({ default: { usePlayer: () => state.player } }));
vi.mock("@/common/lib/cache", () => ({ RendererCache: {} }));
vi.mock("@/common/store/user", () => ({ userStoreSnapshot: () => ({ _user: null }) }));
vi.mock("@/common/store/settings", () => ({ settingsStoreSnapshot: () => ({ _settings: {} }) }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/netease/services/auth", () => ({ Status: {} }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesAuth: {},
  NeteaseServicesAudio: {},
  NeteaseServicesImage: {},
  NeteaseServicesLyric: {}
}));
vi.mock("@/common/player/audio", () => ({ default: class {} }));
vi.mock("@/common/player/history", () => ({ default: class {} }));

const createPlayer = (translations?: LyricTranslation[]) => {
  const player = Object.assign(Object.create(RendererPlayer.prototype) as RendererPlayer, {
    current: {
      tlActive: true,
      tlLanguages: undefined,
      lyric: new NeteaseLyric({
        data: [
          {
            startTime: 0,
            endTime: 1000,
            words: [{ word: "原文", startTime: 0, endTime: 1000 }],
            translatedLyric: "中文",
            translations,
            romanLyric: ""
          }
        ]
      })
    },
    executeListeners: vi.fn()
  });
  state.player = player;
  return player;
};

it("defaults to Chinese and toggles each language independently, including all off", () => {
  const player = createPlayer([
    { language: "en", text: "English" },
    { language: "zh-Hans", text: "中文" }
  ]);
  const view = () => <LyricChange key={player.activeTranslationLanguages.join(",")} />;
  const { rerender } = render(view());
  expect(screen.queryByRole("button", { name: "切换翻译歌词" })).not.toBeInTheDocument();
  const english = () => screen.getByRole("button", { name: "切换英语翻译" });
  const chinese = () => screen.getByRole("button", { name: "切换简体中文翻译" });
  expect(english()).toHaveTextContent("英");
  expect(chinese()).toHaveTextContent("中");
  expect(player.activeTranslationLanguages).toEqual(["zh-Hans"]);
  fireEvent.click(english());
  rerender(view());
  expect(player.activeTranslationLanguages).toEqual(["zh-Hans", "en"]);
  expect(english()).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(chinese());
  rerender(view());
  expect(player.activeTranslationLanguages).toEqual(["en"]);
  fireEvent.click(english());
  rerender(view());
  expect(player.activeTranslationLanguages).toEqual([]);
  expect(player.current.tlActive).toBe(false);
  fireEvent.click(chinese());
  expect(player.activeTranslationLanguages).toEqual(["zh-Hans"]);
  expect(player.current.tlActive).toBe(true);
});

it("retains the original translation button for legacy single-translation lyrics", () => {
  const player = createPlayer();
  render(<LyricChange />);
  const button = screen.getByRole("button", { name: "切换翻译歌词" });
  expect(button).toHaveTextContent("译");
  fireEvent.click(button);
  expect(player.current.tlActive).toBe(false);
});
