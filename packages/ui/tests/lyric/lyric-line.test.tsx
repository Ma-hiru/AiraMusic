import { act, render, screen, fireEvent } from "@testing-library/react";
import { TimeManager } from "@mahiru/ui/common/components/display/lyric/time-manager";
import LyricLineComponent from "@mahiru/ui/common/components/display/lyric/lyric-line";

describe("LyricLine", () => {
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
