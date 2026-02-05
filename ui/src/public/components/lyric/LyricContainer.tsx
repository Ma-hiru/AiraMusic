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
  const [currentLine, setCurrentLine] = useState(-1);
  const [timeManager, setTimeManager] = useState<Nullable<LyricTimeManager>>(null);

  const update = useCallback(
    (deltaMS: number) => {
      timeManager?.update(deltaMS);
    },
    [timeManager]
  );

  const setCurrentTime = useCallback(
    (ms: number) => {
      timeManager?.setCurrentTime(ms);
    },
    [timeManager]
  );

  const calcLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container || currentLine === -1) return;
    const activeLine = container.children[currentLine] as Nullable<HTMLElement>;
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
  }, [currentLine]);

  useLayoutEffect(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    setCurrentLine(-1);
  }, [lyric]);

  useLayoutEffect(() => {
    const timeManager = new LyricTimeManager(lyric?.[version] || []);
    timeManager.onLineChange = ({ lineIndex }) => {
      if (lineIndex === -1) return;
      setCurrentLine(lineIndex);
      calcLayout();
    };
    setTimeManager(timeManager);

    return () => {
      timeManager.onLineChange = null;
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
