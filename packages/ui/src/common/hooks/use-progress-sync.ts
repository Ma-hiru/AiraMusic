import { clamp, throttle } from "lodash-es";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseServicesTrack } from "@/common/netease/services";
import type { PointerEvent, KeyboardEvent } from "react";

export interface PlayerProgressValues {
  buffer: number;
  percent: number;
}

export interface PlayerProgressRef {
  tick: { cancel: () => void } & ((force: boolean, progress: PlayerProgressValues) => void);
}

function clampProgress(percent: number): number {
  return Number.isFinite(percent) ? clamp(percent, 0, 100) : 0;
}

export function useProgressSync({
  onSync,
  onUpdate,
  track,
  paddingLeft = 0,
  paddingRight = 0
}: {
  paddingLeft?: number;
  paddingRight?: number;
  track?: Optional<NeteaseTrackModel>;
  onUpdate?: NormalFunc<[percent: number]>;
  onSync: (progress: Partial<PlayerProgressValues>, immediate: boolean) => void;
}) {
  const sync = useLatestRef(onSync);
  const update = useLatestRef(onUpdate);
  const barRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<null | number>(null);
  const playbackProgress = useRef<PlayerProgressValues>({ buffer: 0, percent: 0 });
  const displayedPercent = useRef(0);

  const renderProgress = useCallback(
    (progress: Partial<PlayerProgressValues>, immediate: boolean) => {
      if (progress.percent !== undefined) {
        displayedPercent.current = progress.percent;
        if (update.current) {
          barRef.current?.setAttribute("aria-valuenow", String(Math.round(progress.percent)));
        }
      }
      sync.current(progress, immediate);
    },
    [sync, update]
  );

  const tick = useMemo<PlayerProgressRef["tick"]>(() => {
    const syncPlayback = throttle(() => {
      if (activePointer.current === null) renderProgress(playbackProgress.current, false);
    }, 500);

    return Object.assign(
      (force: boolean, progress: PlayerProgressValues) => {
        playbackProgress.current = {
          buffer: clampProgress(progress.buffer),
          percent: clampProgress(progress.percent)
        };
        if (force) {
          syncPlayback.cancel();
          activePointer.current = null;
          renderProgress(playbackProgress.current, true);
        } else if (activePointer.current === null) {
          syncPlayback();
        }
      },
      { cancel: syncPlayback.cancel }
    );
  }, [renderProgress]);

  useEffect(() => () => tick.cancel(), [tick]);

  const pointerPercent = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const layoutWidth = event.currentTarget.clientWidth;
    const trackWidth = layoutWidth - paddingLeft - paddingRight;
    if (width <= 0 || trackWidth <= 0) return null;
    const x = ((event.clientX - left) / width) * layoutWidth;
    return clampProgress(((x - paddingLeft) / trackWidth) * 100);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!update.current || activePointer.current !== null || event.button !== 0) return;
    const percent = pointerPercent(event);
    if (percent === null) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointer.current = event.pointerId;
    tick.cancel();
    renderProgress({ percent }, true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    const percent = pointerPercent(event);
    if (percent !== null) renderProgress({ percent }, true);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    const percent = pointerPercent(event) ?? displayedPercent.current;
    renderProgress({ percent }, true);
    update.current?.(percent);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    renderProgress(playbackProgress.current, true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!update.current) return;
    let percent = displayedPercent.current;
    switch (event.key) {
      case "Home":
        percent = 0;
        break;
      case "End":
        percent = 100;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        percent = clampProgress(percent - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        percent = clampProgress(percent + 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    tick.cancel();
    renderProgress({ percent }, true);
    update.current(percent);
  };

  const [chorus, setChorus] = useState<{ id: number; duration: number; positions: number[] }>();
  const id = track?.id;
  const duration = track?.dt;
  useEffect(() => {
    if (!id || !duration) return;
    const controller = new AbortController();
    NeteaseServicesTrack.chorus(id, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const positions = response.chorus.map((part) =>
          Math.floor(clampProgress((part.startTime / duration) * 100))
        );
        setChorus({ id, duration, positions });
      })
      .catch(() => {
        if (!controller.signal.aborted) setChorus(undefined);
      });
    return () => controller.abort();
  }, [id, duration]);

  return {
    tick,
    barRef,
    chorus: chorus?.id === id && chorus?.duration === duration ? chorus?.positions : undefined,
    handlers: {
      onKeyDown,
      onPointerUp,
      onPointerDown,
      onPointerMove,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel
    }
  };
}
