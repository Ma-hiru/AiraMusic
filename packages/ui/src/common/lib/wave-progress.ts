/**
 * Track, thumb and path drawing adapted from AxionOS's WaveformSeekBar.kt.
 * Copyright (C) 2025 AxionOS (upstream portions, Apache-2.0).
 * AiraMusic adapted Android Canvas drawing to Canvas 2D and consumes Bézier segments from WASM.
 * See NOTICE and LICENSE-APACHE-2.0.
 */
type WaveProgressContext = OffscreenCanvasRenderingContext2D;

type WaveProgressFrame = {
  phase: number;
  amplitude: number;
  segments: typeof import("@mahiru/wasm").computeWaveSegments;
};

export function resizeWaveProgress(context: WaveProgressContext, size: WaveProgressSize) {
  const { canvas } = context;
  const width = Math.max(1, Math.round(size.width * size.pixelRatio));
  const height = Math.max(1, Math.round(size.height * size.pixelRatio));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  context.setTransform(
    width / Math.max(1, size.width),
    0,
    0,
    height / Math.max(1, size.height),
    0,
    0
  );
}

export function waveProgressGeometry(
  { width, height }: Pick<WaveProgressSize, "width" | "height">,
  { density, paddingLeft, paddingRight }: WaveProgressOptions,
  progress: { buffer: number; percent: number }
) {
  const centerY = height / 2;
  const trackHeight = Math.min(6 * density, height / 3);
  const drawWidth = Math.max(0, width - paddingLeft - paddingRight);
  const progressLength = (progress.percent / 100) * drawWidth;
  const progressX = paddingLeft + progressLength;
  const thumbRadius = Math.min(8 * density, height * 0.4, width / 2);
  return {
    centerY,
    trackHeight,
    drawWidth,
    progressLength,
    trackTop: centerY - trackHeight / 2,
    bufferLength: (progress.buffer / 100) * drawWidth,
    progressX,
    thumbRadius,
    thumbX: Math.min(width - thumbRadius, Math.max(thumbRadius, progressX)),
    shadowY: centerY + Math.min(2 * density, centerY - thumbRadius)
  };
}

export function drawWaveProgress(
  context: WaveProgressContext,
  size: WaveProgressSize,
  options: WaveProgressOptions,
  progress: { buffer: number; percent: number },
  wave: WaveProgressFrame
) {
  const { width, height } = size;
  const { color, chorus, density, thumbColor, paddingLeft, trackOpacity } = options;
  context.clearRect(0, 0, width, height);
  const {
    thumbX,
    centerY,
    shadowY,
    trackTop,
    drawWidth,
    progressX,
    thumbRadius,
    trackHeight,
    bufferLength,
    progressLength
  } = waveProgressGeometry(size, options, progress);
  if (!drawWidth || height <= 0) return;

  const trackBottom = trackTop + trackHeight;
  const edgeRadius = trackHeight / 2;

  const drawTrack = (length: number, opacity: number) => {
    context.globalAlpha = opacity;
    context.beginPath();
    context.roundRect(paddingLeft, trackTop, length, trackHeight, edgeRadius);
    context.fill();
  };

  context.fillStyle = color;
  drawTrack(drawWidth, trackOpacity);
  if (bufferLength > progressLength) drawTrack(bufferLength, 0.3);

  const startX = paddingLeft + edgeRadius;
  context.globalAlpha = 1;
  if (wave.amplitude > 0.01 && progressX > startX) {
    const segments = wave.segments(
      paddingLeft,
      startX,
      progressX,
      trackTop,
      density,
      wave.phase,
      wave.amplitude * Math.min(1, trackTop / (12 * density))
    );
    context.beginPath();
    context.arc(startX, centerY, edgeRadius, Math.PI / 2, Math.PI);
    context.quadraticCurveTo(paddingLeft, trackTop, startX, trackTop);
    for (let index = 0; index < segments.length; index += 6) {
      context.bezierCurveTo(
        segments[index]!,
        segments[index + 1]!,
        segments[index + 2]!,
        segments[index + 3]!,
        segments[index + 4]!,
        segments[index + 5]!
      );
    }
    context.lineTo(progressX, trackTop);
    context.lineTo(progressX, trackBottom);
    context.closePath();
    context.fill();
  } else if (progressLength > 0) {
    drawTrack(progressLength, 1);
  }

  for (const percent of chorus ?? []) {
    const x = paddingLeft + (percent / 100) * drawWidth;
    context.fillRect(x, trackTop, Math.min(2 * density, paddingLeft + drawWidth - x), trackHeight);
  }

  context.beginPath();
  context.arc(thumbX, shadowY, thumbRadius, 0, Math.PI * 2);
  context.fillStyle = "#000000";
  context.globalAlpha = 60 / 255;
  context.fill();

  context.beginPath();
  context.arc(thumbX, centerY, thumbRadius, 0, Math.PI * 2);
  context.globalAlpha = 1;
  context.fillStyle = thumbColor;
  context.fill();
}
