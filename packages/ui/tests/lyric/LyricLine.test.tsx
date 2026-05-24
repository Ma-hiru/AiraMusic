import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import LyricLine from "@mahiru/ui/common/components/lyric/LyricLine";
import { LyricTimeManager } from "@mahiru/ui/common/components/lyric/LyricTimeManager";

describe("LyricLine", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
  });

  it("renders inline notes without predicate brackets", () => {
    const line: LyricLine = {
      words: [
        { word: "声", startTime: 0, endTime: 500 },
        { word: "（こえ）", startTime: 500, endTime: 1000, inlineNote: true }
      ],
      translatedLyric: "",
      romanLyric: "",
      startTime: 0,
      endTime: 1000,
      isBlank: false,
      isBackChorus: false
    };

    renderLine(
      <LyricLine
        index={0}
        line={line}
        active
        noteActive
        rmActive={false}
        tlActive={false}
        hasRm={false}
        hasTl={false}
        timeManager={new LyricTimeManager([line])}
      />
    );

    expect(host.textContent).toContain("声");
    expect(host.textContent).toContain("こえ");
    expect(host.textContent).not.toContain("（こえ）");
  });

  function renderLine(component: ReactNode) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(component);
    });
  }
});
