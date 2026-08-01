import { cx } from "@emotion/css";
import { debounce } from "lodash-es";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useImperativeHandle
} from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { extendLyric } from "@/common/components/display/lyric/utils";
import RendererTheme from "@/common/player/ui";

import LyricLine from "./lyric-line";
import LyricTips from "./lyric-tips";
import { TimeManager } from "./time-manager";

const edgeFadeMask =
  "linear-gradient(to bottom, transparent 0, #000 min(12%, 56px), #000 calc(100% - min(12%, 56px)), transparent 100%)";

export interface LyricRef {
  calcLayout: NormalFunc<[]>;
  update: NormalFunc<[delta: number]>;
  setCurrentTime: NormalFunc<[time: number]>;
}

interface LyricContainerProps {
  ref: Ref<LyricRef>;
  spring?: boolean;
  fontSize?: number;
  className?: string;
  activeColor?: string;
  inactiveColor?: string;
  playing?: Optional<boolean>;
  rmActive: Optional<boolean>;
  tlActive: Optional<boolean>;
  noteActive: Optional<boolean>;
  lyric: Optional<NeteaseLyricModel>;
  mainAlign?: "top" | "bottom" | "center";
  crossAlign?: "left" | "right" | "center";
  onWordClick?: NormalFunc<[startTime: number]>;
}

const LyricContainer: FC<LyricContainerProps> = ({
  ref,
  className,
  onWordClick,
  spring,
  fontSize,
  rmActive,
  tlActive,
  mainAlign,
  crossAlign,
  noteActive,
  activeColor,
  inactiveColor,
  lyric: _lyric
}) => {
  const [currentLine, setCurrentLine] = useState(-1);
  const [scrolling, setScrolling] = useState(false);
  const lyricLines = useMemo(() => extendLyric(_lyric?.data ?? []), [_lyric?.data]);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const currentLineRef = useRef(currentLine);
  const timeManagerRef = useRef<Nullable<TimeManager>>(null);
  const mainAlignRef = useRef(mainAlign);

  if (timeManagerRef.current === null) {
    timeManagerRef.current = new TimeManager([]);
  }
  mainAlignRef.current = mainAlign;

  // 计算布局的函数
  const innerScrolling = useRef(false);
  const calcLayout = useCallback(() => {
    innerScrolling.current = true;
    const container = containerRef.current;
    const lineIndex = currentLineRef.current;
    const mainAlign = mainAlignRef.current;

    if (!container) return;
    if (lineIndex === -1) {
      return RendererTheme.smoothScrollTo(container, 0);
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

    return RendererTheme.smoothScrollTo(container, scrollTop).finally(
      () => (innerScrolling.current = false)
    );
  }, []);

  // 歌词变化时，重置时间管理器和当前行
  useLayoutEffect(() => {
    timeManagerRef.current?.reset(lyricLines);
    setCurrentLine(-1);
    currentLineRef.current = -1;
    calcLayout();
  }, [calcLayout, lyricLines]);

  // 歌词行变化时，滚动到对应位置
  const scrollingRef = useLatestRef(scrolling);
  useLayoutEffect(() => {
    const timeManager = timeManagerRef.current;
    if (!timeManager) return;
    return timeManager.addEventListener("line-change", () => {
      const lineIndex = timeManager.getCurrentLineIndex();
      setCurrentLine(lineIndex);
      currentLineRef.current = lineIndex;
      !scrollingRef.current && calcLayout();
    });
  }, [calcLayout, scrollingRef]);

  // 暴露接口
  useImperativeHandle(
    ref,
    () => ({
      update: timeManagerRef.current!.update,
      setCurrentTime: timeManagerRef.current!.setCurrentTime,
      calcLayout
    }),
    [calcLayout]
  );

  // 窗口大小变化时，计算布局
  useEffect(() => {
    const cb = debounce(calcLayout, 1000);
    window.addEventListener("resize", cb, { passive: true });
    return () => {
      window.removeEventListener("resize", cb);
    };
  }, [calcLayout]);

  // 布局参数变化时，计算布局
  useEffect(() => {
    calcLayout();
  }, [calcLayout, rmActive, tlActive, mainAlign, crossAlign, noteActive]);

  const scrollTimer = useRef(0);
  const onScroll = useCallback(() => {
    if (innerScrolling.current) return;
    scrollTimer.current && clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      setScrolling(false);
      calcLayout();
    }, 3000);
    setScrolling(true);
  }, [calcLayout]);

  return (
    <div
      ref={containerRef}
      className={cx(
        `
          w-full h-full space-y-3
          scrollbar-hide overflow-y-scroll scroll-auto overflow-x-hidden
          transition-all duration-500 ease-in-out
          contain-content
      `,
        className
      )}
      style={{
        maskImage: edgeFadeMask,
        WebkitMaskImage: edgeFadeMask
      }}
      onScroll={onScroll}>
      <div className={cx("h-[55%]", lyricLines.length === 0 && "h-0")} />
      {lyricLines.map((line, index) => (
        <LyricLine
          key={index}
          line={line}
          index={index}
          spring={spring}
          fontSize={fontSize}
          rmActive={rmActive}
          tlActive={tlActive}
          crossAlign={crossAlign}
          noteActive={noteActive}
          activeColor={activeColor}
          hasRm={_lyric?.rmExisted}
          hasTl={_lyric?.tlExisted}
          inactiveColor={inactiveColor}
          active={currentLine === index}
          timeManager={timeManagerRef.current!}
          onClick={onWordClick}
        />
      ))}
      <div className={cx("h-[55%]", lyricLines.length === 0 && "h-0 pt-0")}>
        <LyricTips tips={_lyric?.tips} crossAlign={crossAlign} />
      </div>
    </div>
  );
};

export default memo(LyricContainer);
