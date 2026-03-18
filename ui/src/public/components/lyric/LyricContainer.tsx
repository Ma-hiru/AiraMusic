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
import AppUI from "@mahiru/ui/public/entry/ui";
import { NeteaseLyric } from "@mahiru/ui/public/models/netease";

interface LyricContainerProps {
  lyric?: Optional<FullVersionLyricLine>;
  version?: LyricVersionType;
  className?: string;
  onWordClick?: NormalFunc<[startTime: number]>;
  activeColor?: string;
  inactiveColor?: string;
  fontSize?: FontSize | number;
  crossAlign?: "left" | "center" | "right";
  mainAlign?: "top" | "center" | "bottom";
}

export interface LyricRef {
  update: NormalFunc<[delta: number]>;
  setCurrentTime: NormalFunc<[time: number]>;
  calcLayout: NormalFunc<[]>;
}

const LyricContainer: ForwardRefRenderFunction<LyricRef, LyricContainerProps> = (
  {
    lyric,
    version = "raw",
    className,
    onWordClick,
    activeColor,
    inactiveColor,
    fontSize,
    crossAlign,
    mainAlign
  },
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
      return AppUI.smoothScrollTo(container, 0);
    }

    const activeLine = container.children[lineIndex + 1] as Nullable<HTMLElement>;
    if (!activeLine) return;

    const containerHeight = container.clientHeight;
    const lineOffsetTop = activeLine.offsetTop;
    const lineHeight = activeLine.clientHeight;

    let scrollTop;
    if (mainAlign === "top") {
      scrollTop = lineOffsetTop;
    } else if (mainAlign === "bottom") {
      scrollTop = lineOffsetTop - containerHeight + lineHeight;
    } else {
      scrollTop = lineOffsetTop - containerHeight / 2 + lineHeight / 2;
    }

    AppUI.smoothScrollTo(container, scrollTop);
  }, [mainAlign]);

  useLayoutEffect(() => {
    timeManagerRef.current?.reset(lyric?.raw ?? NeteaseLyric.blankLyric.raw);
    setCurrentLine(-1);
    currentLineRef.current = -1;
    calcLayout();
  }, [calcLayout, lyric]);

  useLayoutEffect(() => {
    const timeManager = timeManagerRef.current;
    if (!timeManager) return;
    timeManager.onLineChange = ({ lineIndex }) => {
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
          scrollbar-hide overflow-y-scroll scroll-auto overflow-x-hidden
          transition-all duration-500 ease-in-out
          contain-content mix-blend-plus-lighter
      `,
        className
      )}>
      <div className="h-[55%]" />
      {(lyric?.[version] ?? NeteaseLyric.blankLyric.raw).map((line, index) => (
        <LyricLine
          activeColor={activeColor}
          inactiveColor={inactiveColor}
          fontSize={fontSize}
          key={index}
          line={line}
          index={index}
          onClick={onWordClick}
          timeManager={timeManagerRef.current!}
          active={currentLine === index}
          crossAlign={crossAlign}
        />
      ))}
      <div className="h-[55%]" />
    </div>
  );
};

LyricContainer.displayName = "LyricContainer";
export default memo(forwardRef(LyricContainer));
