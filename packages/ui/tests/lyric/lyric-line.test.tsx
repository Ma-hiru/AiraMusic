import { fireEvent, render, screen } from "@testing-library/react";
import { LyricTimeManager } from "@mahiru/ui/common/components/display/lyric/lyric-time-manager";
import LyricLineComponent from "@mahiru/ui/common/components/display/lyric/lyric-line";

describe("LyricLine", () => {
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

  function renderLine(line: LyricLine, props: Partial<LyricLineComponentProps> = {}) {
    return render(createElement(line, props));
  }

  function createElement(line: LyricLine, props: Partial<LyricLineComponentProps> = {}) {
    return (
      <LyricLineComponent
        index={0}
        line={line}
        active
        noteActive={false}
        rmActive={false}
        tlActive={false}
        hasRm={false}
        hasTl={false}
        timeManager={new LyricTimeManager([line])}
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
