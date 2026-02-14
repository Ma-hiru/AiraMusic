import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import { LyricTimeManager } from "./LyricTimeManager";

import LyricLine from "./LyricLine";
import { NeteaseLyric } from "@mahiru/ui/public/entry/lyric";
import { UIUtils } from "@mahiru/ui/public/utils/ui_utils";

interface LyricContainerProps {
  lyric?: FullVersionLyricLine;
  version?: LyricVersionType;
  className?: string;
  onWordClick?: NormalFunc<[startTime: number]>;
}

export interface LyricRef {
  update: NormalFunc<[delta: number]>;
  setCurrentTime: NormalFunc<[time: number]>;
  calcLayout: NormalFunc<[]>;
}

const LyricContainer: ForwardRefRenderFunction<LyricRef, LyricContainerProps> = (
  { lyric, version = "raw", className, onWordClick },
  ref
) => {
  const [currentLine, setCurrentLine] = useState(-1);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const currentLineRef = useRef(currentLine);
  const timeManagerRef = useRef<Nullable<LyricTimeManager>>(null);
  if (timeManagerRef.current === null) {
    timeManagerRef.current = new LyricTimeManager([]);
  }

  const calcLayout = useCallback(() => {
    const container = containerRef.current;
    const lineIndex = currentLineRef.current;
    if (!container) return;
    if (lineIndex === -1) {
      container.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      return;
    }
    const activeLine = container.children[lineIndex + 1] as Nullable<HTMLElement>;
    if (!activeLine) return;
    const containerHeight = container.clientHeight;
    const lineOffsetTop = activeLine.offsetTop;
    const lineHeight = activeLine.clientHeight;
    const scrollTop = lineOffsetTop - containerHeight / 2 + lineHeight / 2;

    UIUtils.smoothScrollTo(container, scrollTop);
  }, []);

  useLayoutEffect(() => {
    timeManagerRef.current?.reset(lyric?.raw ?? NeteaseLyric.blankLyricPreset.raw);
    setCurrentLine(-1);
    currentLineRef.current = -1;
    calcLayout();
  }, [calcLayout, lyric]);

  useLayoutEffect(() => {
    const timeManager = timeManagerRef.current;
    if (!timeManager) return;
    timeManager.onLineChange = ({ lineIndex }) => {
      if (lineIndex === -1) return;
      setCurrentLine(lineIndex);
      currentLineRef.current = lineIndex;
      calcLayout();
    };
    return () => {
      timeManager.dispose();
    };
  }, [calcLayout]);

  useImperativeHandle(
    ref,
    () => ({
      update: timeManagerRef.current!.update,
      setCurrentTime: timeManagerRef.current!.setCurrentTime,
      calcLayout
    }),
    [calcLayout]
  );

  return (
    <div
      ref={containerRef}
      className={cx(
        `
          w-full h-full space-y-4
          scrollbar-hide overflow-y-scroll scroll-auto
          transition-all duration-500 ease-in-out
          contain-content
      `,
        className
      )}>
      <div className="h-[55%]" />
      {(lyric?.[version] ?? NeteaseLyric.blankLyricPreset.raw).map((line, index) => (
        <LyricLine
          key={index}
          line={line}
          index={index}
          onClick={onWordClick}
          timeManager={timeManagerRef.current!}
          active={currentLine === index}
        />
      ))}
      <div className="h-[55%]" />
    </div>
  );
};

LyricContainer.displayName = "LyricContainer";
export default memo(forwardRef(LyricContainer));
