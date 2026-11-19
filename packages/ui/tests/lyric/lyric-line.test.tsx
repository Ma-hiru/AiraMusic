import { act, render, screen, fireEvent } from "@testing-library/react";
import { Log } from "@mahiru/ui/common/lib/log";
import { RendererWindow } from "@mahiru/ui/common/lib/window";
import { RendererIPCMessageBus } from "@mahiru/ui/common/lib/bus";
import { TimeManager } from "@mahiru/ui/common/components/display/lyric/time-manager";
import LyricLineComponent from "@mahiru/ui/common/components/display/lyric/lyric-line";

describe("LyricLine", () => {
  it("renders selected translation languages independently", () => {
    const line = createLyricLine({
      translatedLyric: "中文翻译",
      translations: [
        { language: "en", text: "English translation" },
        { language: "zh-Hans", text: "中文翻译" }
      ]
    });
    const { rerender } = renderLine(line, { hasTl: true, tlActive: true, tlLanguages: ["en"] });
    expect(screen.getByText("English translation")).toBeInTheDocument();
    expect(screen.queryByText("中文翻译")).not.toBeInTheDocument();
    rerender(createElement(line, { hasTl: true, tlActive: true, tlLanguages: ["en", "zh-Hans"] }));
    expect(screen.getByText("中文翻译")).toBeInTheDocument();
    rerender(createElement(line, { hasTl: true, tlActive: false, tlLanguages: ["en", "zh-Hans"] }));
    expect(screen.queryByText("English translation")).not.toBeInTheDocument();
  });

  it("renders supplied credit avatars and artist links without seeking on click", () => {
    const onArtistClick = vi.fn();
    const onClick = vi.fn();
    const entry: LyricEmbed = {
      t: 4000,
      position: 8,
      c: [
        { tx: "演唱：" },
        {
          tx: "歌手",
          li: "https://example.com/avatar.jpg",
          or: "orpheus://nm/artist/home?id=17301&type=artist"
        },
        { tx: "纯文本", or: "https://example.com/artist/42" }
      ]
    };
    const line = { ...createLyricLine({ words: [] }), embeds: [entry], wait: false as const };
    const { container } = renderLine(line, { line, onClick, onArtistClick });
    fireEvent.click(screen.getByRole("button", { name: "歌手" }));
    expect(onArtistClick).toHaveBeenCalledExactlyOnceWith(17301);
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "纯文本" })).not.toBeInTheDocument();
  });

  it.each(["display", "callback"])("handles artist navigation timing out via %s", async (entry) => {
    vi.useFakeTimers();
    const deliver = vi.spyOn(RendererIPCMessageBus.display, "deliver");
    try {
      const onArtistClick =
        entry === "callback" ? () => RendererWindow.display.reactReadyAwait() : undefined;
      const lyric = createLyricLine({ words: [] });
      const line = {
        ...lyric,
        embeds: [
          { t: 0, position: 0, c: [{ tx: "歌手", or: "orpheus://nm/artist/home?id=17301" }] }
        ],
        wait: false as const
      };
      renderLine(lyric, { line, onArtistClick });
      fireEvent.click(screen.getByRole("button", { name: "歌手" }));
      await act(async () => await vi.advanceTimersByTimeAsync(5_000));

      expect(deliver).not.toHaveBeenCalled();
      expect(Log.warn).toHaveBeenCalledExactlyOnceWith(
        "LyricEmbed",
        "打开歌手页面失败",
        17301,
        expect.objectContaining({ name: "TimeoutError" })
      );
    } finally {
      deliver.mockRestore();
      vi.useRealTimers();
    }
  });

  it("shows timed word roman as notes only when enabled, preserving the roman lyric below", () => {
    const line = createLyricLine({
      words: [{ word: "渚", startTime: 0, endTime: 1000, romanWord: "na gi sa" }],
      romanLyric: "na gi sa wo"
    });
    const { rerender } = renderLine(line, { noteActive: true, hasRm: true, rmActive: true });
    expect(screen.getByText("na gi sa")).toBeInTheDocument();
    expect(screen.getByText("na gi sa wo")).toBeInTheDocument();
    rerender(createElement(line, { noteActive: false, hasRm: true, rmActive: true }));
    expect(screen.queryByText("na gi sa")).not.toBeInTheDocument();
    expect(screen.getByText("na gi sa wo")).toBeInTheDocument();
  });

  it("prefers existing kana notes over word roman", () => {
    renderLine(
      createLyricLine({
        words: [
          { word: "声", startTime: 0, endTime: 500, romanWord: "ko e" },
          { word: "（こえ）", startTime: 0, endTime: 500, inlineNote: true }
        ]
      }),
      { noteActive: true }
    );
    expect(screen.getByText("こえ")).toBeInTheDocument();
    expect(screen.queryByText("ko e")).not.toBeInTheDocument();
  });

  it("renders inline notes without predicate brackets", () => {
    const line = createLyricLine({
      words: [
        { word: "声", startTime: 0, endTime: 500 },
        { word: "（こえ）", startTime: 500, endTime: 1000, inlineNote: true }
      ]
    });

    renderLine(line, {
      active: true,
      noteActive: true
    });

    expect(screen.getByText("声")).toBeInTheDocument();
    expect(screen.getByText("こえ")).toBeInTheDocument();
    expect(screen.queryByText("（こえ）")).not.toBeInTheDocument();
  });

  it("hides inline notes when note rendering is disabled", () => {
    const line = createLyricLine({
      words: [
        { word: "声", startTime: 0, endTime: 500 },
        { word: "（こえ）", startTime: 500, endTime: 1000, inlineNote: true }
      ]
    });

    renderLine(line, {
      active: true,
      noteActive: false
    });

    expect(screen.getByText("声")).toBeInTheDocument();
    expect(screen.queryByText("こえ")).not.toBeInTheDocument();
  });

  it("renders translated and romanized lyric lines only when enabled", () => {
    const line = createLyricLine({
      translatedLyric: "translated line",
      romanLyric: "roman line"
    });

    const { rerender } = renderLine(line, {
      tlActive: true,
      hasTl: true,
      rmActive: false,
      hasRm: true
    });

    expect(screen.getByText("translated line")).toBeInTheDocument();
    expect(screen.queryByText("roman line")).not.toBeInTheDocument();

    rerender(createElement(line, { tlActive: true, hasTl: true, rmActive: true, hasRm: true }));

    expect(screen.getByText("translated line")).toBeInTheDocument();
    expect(screen.getByText("roman line")).toBeInTheDocument();
  });

  it("uses the first word time when translated or romanized text is clicked", () => {
    const onClick = vi.fn();
    const line = createLyricLine({
      words: [
        { word: "a", startTime: 1200, endTime: 1500 },
        { word: "b", startTime: 1500, endTime: 1800 }
      ],
      translatedLyric: "translated line",
      romanLyric: "roman line"
    });

    renderLine(line, {
      tlActive: true,
      hasTl: true,
      rmActive: true,
      hasRm: true,
      onClick
    });

    fireEvent.click(screen.getByText("translated line"));
    fireEvent.click(screen.getByText("roman line"));

    expect(onClick).toHaveBeenNthCalledWith(1, 1200);
    expect(onClick).toHaveBeenNthCalledWith(2, 1200);
  });

  it("renders inactive lines as a single lyric without inline notes", () => {
    const line = createLyricLine({
      words: [
        { word: "声", startTime: 0, endTime: 500 },
        { word: "（こえ）", startTime: 500, endTime: 1000, inlineNote: true },
        { word: "が", startTime: 1000, endTime: 1500 }
      ]
    });

    const { container } = renderLine(line, {
      active: false,
      noteActive: true
    });

    expect(container).toHaveTextContent("声が");
    expect(container).not.toHaveTextContent("こえ");
  });

  it("synchronizes word progress when mounting an already active line", () => {
    const line = createLyricLine({
      words: [
        { word: "first", startTime: 0, endTime: 500 },
        { word: "last", startTime: 500, endTime: 1000 }
      ]
    });
    const manager = new TimeManager([{ ...line, wait: false }]);
    manager.update(750);

    renderLine(line, { timeManager: manager });

    expect(screen.getByText("first")).toHaveClass("blur-none");
    expect(screen.getByText("last")).toHaveClass("lyric-word-active");
  });

  it("keeps completed words clear when two singing lines become one focused line", () => {
    const line = createLyricLine({
      startTime: 1000,
      endTime: 2000,
      words: [
        { word: "first", startTime: 1000, endTime: 1200 },
        { word: "middle", startTime: 1200, endTime: 1400 },
        { word: "last", startTime: 1400, endTime: 2000 }
      ],
      translatedLyric: "translation"
    });
    const manager = new TimeManager([
      { ...line, wait: false },
      { ...line, isBG: true, wait: false }
    ]);
    renderLine(line, { index: 1, timeManager: manager, hasTl: true, tlActive: true });

    act(() => {
      manager.update(1450);
    });
    expect(manager.getCurrentLineIndex()).toEqual([0, 1]);
    expect(screen.getByText("last")).toHaveClass("lyric-word-active");

    act(() => {
      manager.update(600);
    });
    expect(manager.getCurrentLineIndex()).toEqual([1]);
    for (const word of ["first", "middle", "last"]) {
      expect(screen.getByText(word)).toHaveClass("blur-none");
    }
    expect(screen.getByText("last")).toHaveClass("lyric-word-active");
    expect(screen.getByText("translation").closest("section")).not.toHaveClass("blur-[2px]");
  });

  function renderLine(line: LyricLine, props: Partial<LyricLineComponentProps> = {}) {
    return render(createElement(line, props));
  }

  function createElement(line: LyricLine, props: Partial<LyricLineComponentProps> = {}) {
    return (
      <LyricLineComponent
        index={0}
        hasRm={false}
        hasTl={false}
        rmActive={false}
        tlActive={false}
        noteActive={false}
        line={{ ...line, wait: false }}
        timeManager={new TimeManager([{ ...line, wait: false }])}
        active
        {...props}
      />
    );
  }
});

type LyricLineComponentProps = Parameters<typeof LyricLineComponent>[0];

function createLyricLine(props: Partial<LyricLine> = {}): LyricLine {
  return {
    words: [{ word: "lyric", startTime: 0, endTime: 1000 }],
    translatedLyric: "",
    romanLyric: "",
    startTime: 0,
    endTime: 1000,
    isBlank: false,
    isBackChorus: false,
    ...props
  };
}
