/**
 * Static track and thumb styling adapted from AxionOS's WaveformSeekBar.kt.
 * Copyright (C) 2025 AxionOS (upstream portions, Apache-2.0).
 * AiraMusic renders the static appearance with SVG in React.
 * https://github.com/AxionAOSP/android_frameworks_base/blob/b41823f8e730bb78dbaf742b3cf5fed9478b93cd/packages/SystemUI/src/com/android/systemui/media/controls/ui/view/WaveformSeekBar.kt
 * See NOTICE and LICENSE-APACHE-2.0.
 */
import { cx } from "@emotion/css";
import { memo, useRef, type FC, useMemo, useEffect, useImperativeHandle } from "react";
import { waveProgressGeometry } from "@/common/lib/wave-progress";
import { useProgressSync } from "@/common/hooks/use-progress-sync";
import { useWaveProgressWorker } from "@/common/hooks/use-wave-progress-worker";
import type { RefObject, CSSProperties } from "react";
import type { PlayerProgressRef } from "@/common/hooks/use-progress-sync";

interface WaveformSeekBarProps {
  ref?: RefObject<Nullable<PlayerProgressRef>>;
  color?: string;
  width?: number;
  height?: number;
  density?: number;
  playing: boolean;
  visible?: boolean;
  className?: string;
  thumbColor?: string;
  paddingLeft?: number;
  paddingRight?: number;
  style?: CSSProperties;
  trackOpacity?: number;
  track?: Optional<NeteaseTrackModel>;
  onUpdate?: NormalFunc<[percent: number]>;
  /** 独立展示时的播放进度，范围 0 ~ 1 */
  progress?: number;
}

const WavePlayerProgress: FC<WaveformSeekBarProps> = ({
  ref,
  className,
  onUpdate,
  style,
  track,
  playing,
  progress,
  density = 1,
  height = 48,
  width = 320,
  visible = true,
  paddingLeft = 0,
  paddingRight = 0,
  color = "#ffffff",
  thumbColor = "#ffffff",
  trackOpacity = 77 / 255
}) => {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const options = useMemo<WaveProgressOptions>(
    () => ({
      color,
      thumbColor,
      density: Number.isFinite(density) && density > 0 ? density : 1,
      paddingLeft,
      paddingRight,
      trackOpacity,
      playing,
      visible
    }),
    [color, thumbColor, density, paddingLeft, paddingRight, trackOpacity, playing, visible]
  );
  const { staticFrame, updateChorus, updateProgress } = useWaveProgressWorker(
    canvasHostRef,
    options
  );
  const { tick, barRef, chorus, handlers } = useProgressSync({
    track,
    onUpdate,
    paddingLeft,
    paddingRight,
    onSync: updateProgress
  });
  useImperativeHandle(ref, () => ({ tick }), [tick]);

  useEffect(() => updateChorus(chorus), [chorus, updateChorus]);
  useEffect(() => {
    if (!ref && progress !== undefined) tick(true, { percent: progress * 100, buffer: 0 });
  }, [progress, ref, tick]);

  return (
    <div
      ref={barRef}
      className={cx(
        "relative block max-w-full",
        onUpdate && "touch-none cursor-pointer outline-none",
        className
      )}
      style={{ width, height, ...style }}
      tabIndex={onUpdate && 0}
      role={onUpdate && "slider"}
      aria-valuemin={onUpdate && 0}
      aria-valuenow={onUpdate && 0}
      aria-label={onUpdate && "播放进度"}
      aria-valuemax={onUpdate && 100}
      {...handlers}>
      <div ref={canvasHostRef} className="absolute inset-0 pointer-events-none" />
      {staticFrame && <StaticWaveProgress chorus={chorus} options={options} frame={staticFrame} />}
    </div>
  );
};

function StaticWaveProgress({
  frame,
  chorus,
  options
}: {
  chorus?: number[];
  options: WaveProgressOptions;
  frame: { width: number; height: number; progress: { buffer: number; percent: number } };
}) {
  const { color, density, thumbColor, paddingLeft, trackOpacity } = options;
  const {
    thumbX,
    centerY,
    shadowY,
    trackTop,
    drawWidth,
    thumbRadius,
    trackHeight,
    bufferLength,
    progressLength
  } = waveProgressGeometry(frame, options, frame.progress);
  if (!drawWidth) return null;

  return (
    <svg
      className="absolute inset-0 block size-full pointer-events-none"
      aria-hidden="true"
      preserveAspectRatio="none"
      viewBox={`0 0 ${frame.width} ${frame.height}`}>
      <g fill={color}>
        <rect
          y={trackTop}
          x={paddingLeft}
          width={drawWidth}
          height={trackHeight}
          rx={trackHeight / 2}
          opacity={trackOpacity}
        />
        {bufferLength > progressLength && (
          <rect
            y={trackTop}
            opacity={0.3}
            x={paddingLeft}
            height={trackHeight}
            rx={trackHeight / 2}
            width={bufferLength}
          />
        )}
        {progressLength > 0 && (
          <rect
            y={trackTop}
            x={paddingLeft}
            height={trackHeight}
            rx={trackHeight / 2}
            width={progressLength}
          />
        )}
        {chorus?.map((percent, index) => {
          const x = (percent / 100) * drawWidth;
          return (
            <rect
              key={index}
              y={trackTop}
              x={paddingLeft + x}
              height={trackHeight}
              width={Math.min(2 * density, drawWidth - x)}
            />
          );
        })}
      </g>
      <circle cx={thumbX} cy={shadowY} fill="#000000" r={thumbRadius} opacity={60 / 255} />
      <circle cx={thumbX} cy={centerY} r={thumbRadius} fill={thumbColor} />
    </svg>
  );
}

export default memo(WavePlayerProgress);
