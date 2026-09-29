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
import { useStableArray } from "@/common/hooks/use-stable-array";
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
  playing,
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
  const lyricLines = useMemo(() => extendLyric(_lyric?.data ?? []), [_lyric?.data]);

  const [_currentLine, setCurrentLine] = useState([-1]);
  const currentLine = useStableArray(_currentLine);
  const currentLineRef = useRef(currentLine);

  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const timeManagerRef = useRef<Nullable<TimeManager>>(null);
  const mainAlignRef = useRef(mainAlign);

  if (timeManagerRef.current === null) {
    timeManagerRef.current = new TimeManager([]);
  }
  mainAlignRef.current = mainAlign;

  // 计算布局的函数
  const innerScrolling = useRef(false); // 是否是由于calcLayout引起的的滚动
  const calcLayout = useCallback(() => {
    const container = containerRef.current;
    const lineIndex = currentLineRef.current;
    const mainAlign = mainAlignRef.current;

    if (!container) return;
    if (lineIndex.length === 0 || (lineIndex.length === 1 && lineIndex[0] === -1)) {
      innerScrolling.current = true;
      return RendererTheme.smoothScrollTo(container, 0).then(
        ({ status }) => status === "finished" && (innerScrolling.current = false)
      );
    }

    const activeLine = lineIndex
      .filter((l) => l >= 0)
      .flatMap((l) => {
        const e = container.children[l + 1];
        if (!e) return [];
        return [e as HTMLElement];
      });
    if (!activeLine.length) return;

    const containerHeight = container.clientHeight;
    const lineOffsetTop = activeLine.at(0)!.offsetTop;
    const lineHeight = activeLine.reduce((acc, cur) => acc + cur.clientHeight, 0);

    let scrollTop;
    if (mainAlign === "top") {
      scrollTop = lineOffsetTop;
    } else if (mainAlign === "bottom") {
      scrollTop = lineOffsetTop - containerHeight + lineHeight;
    } else {
      scrollTop = lineOffsetTop - containerHeight / 2 + lineHeight / 2;
    }

    innerScrolling.current = true;
    return RendererTheme.smoothScrollTo(container, scrollTop).then(
      ({ status }) => status === "finished" && (innerScrolling.current = false)
    );
  }, []);

  // 歌词行变化时，滚动到对应位置
  const [scrolling, setScrolling] = useState(false);
  const scrollingRef = useLatestRef(scrolling);
  useLayoutEffect(() => {
    const timeManager = timeManagerRef.current;
    if (!timeManager) return;
    return timeManager.addEventListener("line-change", () => {
      const lineIndex = timeManager.getCurrentLineIndex();
      setCurrentLine(lineIndex);
      currentLineRef.current = lineIndex; // 这里立即赋值是为了calcLayout使用
      !scrollingRef.current && calcLayout();
    });
  }, [calcLayout, scrollingRef]);

  // 手动滚动且播放时，标记 scrolling 为 true
  const scrollTimer = useRef(0);
  const playingRef = useLatestRef(playing);
  const onScroll = useCallback(() => {
    if (innerScrolling.current || playingRef.current === false) return;
    scrollTimer.current && clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      setScrolling(false);
      calcLayout();
    }, 3000);
    setScrolling(true);
  }, [calcLayout, playingRef]);

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

  // 歌词变化时，重置时间管理器和当前行
  useLayoutEffect(() => {
    timeManagerRef.current?.reset(lyricLines);
    const reset = [-1];
    setCurrentLine(reset);
    currentLineRef.current = reset;
    calcLayout();
  }, [calcLayout, lyricLines]);

  // 窗口大小变化时，计算布局
  useEffect(() => {
    const cb = debounce(calcLayout, 1000);
    window.addEventListener("resize", cb, { passive: true });
    return () => {
      window.removeEventListener("resize", cb);
    };
  }, [calcLayout]);

  // 参数变化时，计算布局
  useEffect(() => {
    calcLayout();
  }, [calcLayout, rmActive, tlActive, mainAlign, crossAlign, noteActive, playing]);

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
      {lyricLines.map((line, index) => {
        const active_index = currentLine.indexOf(index);
        return (
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
            active={active_index !== -1}
            inactiveColor={inactiveColor}
            timeManager={timeManagerRef.current!}
            onClick={onWordClick}
          />
        );
      })}
      <div className={cx("h-[55%]", lyricLines.length === 0 && "h-0 pt-0")}>
        <LyricTips fontSize={fontSize} tips={_lyric?.tips} crossAlign={crossAlign} />
      </div>
    </div>
  );
};

export default memo(LyricContainer);
