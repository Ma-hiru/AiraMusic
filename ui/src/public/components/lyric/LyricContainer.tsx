import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import { LyricTimeManager } from "./LyricTimeManager";

import LyricLine from "./LyricLine";

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
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const currentLineRef = useRef(-1);
  const timeManagerRef = useRef<Nullable<LyricTimeManager>>(null);
  const [currentLine, setCurrentLine] = useState(-1);
  const [timeManager, setTimeManager] = useState<Nullable<LyricTimeManager>>(null);

  const update = useCallback((deltaMS: number) => {
    timeManagerRef.current?.update(deltaMS);
  }, []);

  const setCurrentTime = useCallback((ms: number) => {
    timeManagerRef.current?.setCurrentTime(ms);
  }, []);

  const calcLayout = useCallback(() => {
    const container = containerRef.current;
    const lineIndex = currentLineRef.current;
    if (!container || lineIndex === -1) return;
    const activeLine = container.children[lineIndex] as Nullable<HTMLElement>;
    if (activeLine) {
      const containerHeight = container.clientHeight;
      const lineOffsetTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;
      const scrollTop = lineOffsetTop - containerHeight / 2 + lineHeight / 2;
      container.scrollTo({
        top: scrollTop,
        behavior: "smooth"
      });
    }
  }, []);

  useLayoutEffect(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    setCurrentLine(-1);
    currentLineRef.current = -1;
  }, [lyric]);

  useLayoutEffect(() => {
    const timeManager = new LyricTimeManager(lyric?.[version] || []);
    timeManagerRef.current = timeManager;
    setTimeManager(timeManager);
    timeManager.onLineChange = ({ lineIndex }) => {
      if (lineIndex === -1) return;
      currentLineRef.current = lineIndex;
      setCurrentLine(lineIndex);
      calcLayout();
    };

    return () => {
      timeManager.dispose();
      timeManagerRef.current = null;
      setTimeManager(null);
    };
  }, [calcLayout, lyric, version]);

  useImperativeHandle(
    ref,
    () => ({
      update,
      setCurrentTime,
      calcLayout
    }),
    [calcLayout, setCurrentTime, update]
  );

  const render = useMemo(() => {
    return lyric?.[version].map((line, index) => (
      <LyricLine
        key={index}
        line={line}
        index={index}
        onClick={onWordClick}
        timeManager={timeManager}
        active={currentLine === index}
      />
    ));
  }, [currentLine, lyric, onWordClick, timeManager, version]);

  return (
    <div
      ref={containerRef}
      className={cx(
        "w-full h-full scrollbar-hide overflow-y-scroll space-y-4 transition-all duration-300 ease-in-out pt-[50%] pb-[50%]",
        className
      )}>
      {render}
    </div>
  );
};
export default memo(forwardRef(LyricContainer));
