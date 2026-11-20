/**
 * Wave phase and amplitude timing adapted from AxionOS's WaveformSeekBar.kt.
 * Copyright (C) 2025 AxionOS (upstream portions, Apache-2.0).
 * AiraMusic adapted Android animator timing to the worker frame loop.
 * See NOTICE and LICENSE-APACHE-2.0.
 */
import { drawWaveProgress, resizeWaveProgress } from "@/common/lib/wave-progress";
import init, { computeWaveSegments } from "@mahiru/wasm";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const tau = Math.PI * 2;
let context: null | OffscreenCanvasRenderingContext2D = null;
let size: WaveProgressSize;
let appliedSize: undefined | WaveProgressSize;
let options: WaveProgressOptions;
let wasm: undefined | ReturnType<typeof init>;
let surfaceId: number | undefined;
let ready = false;
let failed = false;
let frame: number | undefined;

let phase = 0;
let phaseStart = 0;
let amplitude = 0;
let amplitudeFrom = 0;
let amplitudeStart = 0;

type ProgressTransition = { to: number; from: number; start: number; duration: number };
let percent: ProgressTransition;
let buffer: ProgressTransition;

function progressAt(transition: ProgressTransition, now: number) {
  if (transition.duration === 0) return transition.to;
  const elapsed = Math.min(1, Math.max(0, (now - transition.start) / transition.duration));
  return transition.from + (transition.to - transition.from) * elapsed;
}

function updateProgress(
  transition: ProgressTransition,
  to: number,
  now: number,
  immediate: boolean
) {
  if (!immediate && transition.to === to) return transition;
  const from = progressAt(transition, now);
  return { from, to, start: now, duration: immediate || from === to ? 0 : 500 };
}

function updateWave(now: number) {
  const t = Math.min(1, Math.max(0, (now - amplitudeStart) / 300));
  const eased = 0.5 - Math.cos(Math.PI * t) / 2;
  amplitude = amplitudeFrom + ((options.playing ? 1 : 0) - amplitudeFrom) * eased;
  if (options.playing) phase = ((Math.max(0, now - phaseStart) / 3500) * tau) % tau;
}

function stopFrame() {
  if (frame === undefined) return;
  scope.cancelAnimationFrame(frame);
  frame = undefined;
}

function releaseSurface() {
  stopFrame();
  surfaceId = undefined;
  if (context) {
    // Clear the backing store immediately instead of waiting for the context to be collected.
    context.canvas.width = 1;
    context.canvas.height = 1;
    context = null;
  }
  appliedSize = undefined;
  ready = false;
}

function reportError(error: unknown) {
  failed = true;
  releaseSurface();
  scope.postMessage({ type: "error", error: String(error) } satisfies WaveProgressWorkerResult);
}

function requestFrame() {
  if (!context || failed || frame !== undefined) return;
  frame = scope.requestAnimationFrame(draw);
}

function draw(now: number) {
  frame = undefined;
  if (!context || surfaceId === undefined) return;

  try {
    updateWave(now);
    if (!options.playing && amplitude <= 0.01) {
      const id = surfaceId;
      releaseSurface();
      scope.postMessage({ type: "idle", id } satisfies WaveProgressWorkerResult);
      return;
    }
    if (appliedSize !== size) {
      resizeWaveProgress(context, size);
      appliedSize = size;
    }
    drawWaveProgress(
      context,
      size,
      options,
      { percent: progressAt(percent, now), buffer: progressAt(buffer, now) },
      { phase, amplitude, segments: computeWaveSegments }
    );
    if (!ready) {
      ready = true;
      scope.postMessage({ type: "ready", id: surfaceId } satisfies WaveProgressWorkerResult);
    }
    requestFrame();
  } catch (error) {
    reportError(error);
  }
}

scope.addEventListener("message", async ({ data }: MessageEvent<WaveProgressWorkerArgs>) => {
  if (failed || (surfaceId === undefined && data.type !== "attach")) return;
  const now = performance.now();

  try {
    switch (data.type) {
      case "attach": {
        releaseSurface();
        surfaceId = data.id;
        size = data.size;
        options = data.options;
        amplitude = amplitudeFrom = phase = 0;
        amplitudeStart = phaseStart = now;
        percent = {
          from: data.progress.percent,
          to: data.progress.percent,
          start: now,
          duration: 0
        };
        buffer = { from: data.progress.buffer, to: data.progress.buffer, start: now, duration: 0 };
        await (wasm ??= init());
        if (surfaceId !== data.id) return;
        context = data.canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");
        data.canvas.addEventListener("contextlost", () => {
          if (surfaceId === data.id) reportError("Canvas 2D context lost");
        });
        break;
      }
      case "detach":
        releaseSurface();
        return;
      case "resize":
        size = data.size;
        break;
      case "options":
        if (options.playing !== data.options.playing) {
          updateWave(now);
          amplitudeFrom = amplitude;
          amplitudeStart = now;
          if (data.options.playing) {
            phaseStart = now;
          } else {
            percent = updateProgress(percent, percent.to, now, true);
            buffer = updateProgress(buffer, buffer.to, now, true);
          }
        }
        options = data.options;
        break;
      case "progress": {
        const immediate = data.immediate || !options.playing;
        if (data.percent !== undefined)
          percent = updateProgress(percent, data.percent, now, immediate);
        if (data.buffer !== undefined) buffer = updateProgress(buffer, data.buffer, now, immediate);
        break;
      }
    }
    requestFrame();
  } catch (error) {
    reportError(error);
  }
});
