import {
  Score,
  argbFromRgb,
  hexFromArgb,
  QuantizerCelebi,
  themeFromSourceColor
} from "@material/material-color-utilities";
import {
  MONET_TONES,
  MONET_PALETTES,
  type ImageColors,
  type TonalColors,
  type MonetPaletteName,
  type MonetWorkerResult,
  type MonetWorkerRequest
} from "@/common/player/monet";

/** 封面下载超时，避免个别请求永久占住 worker 队列 */
const FETCH_TIMEOUT = 15_000;
const COVER_COLOR_LIMIT = 16;

self.addEventListener("message", (event: MessageEvent<MonetWorkerRequest>) => {
  const request = event.data;
  if (!request) return;
  void extract(request);
});

async function extract(request: MonetWorkerRequest) {
  try {
    const colors = await extractImageColors(request.url, request.maxDimension);
    self.postMessage({ id: request.id, type: "palette", colors } satisfies MonetWorkerResult);
  } catch (err) {
    self.postMessage({
      id: request.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err)
    } satisfies MonetWorkerResult);
  }
}

/**
 * 从图片 URL 提取 Material 3 调色盘。
 *
 * 全流程在 worker 内完成：fetch → ImageBitmap 解码 → OffscreenCanvas 缩放 → 取色。
 * 主线程只接收序列化后的纯数据，切歌时不会掉帧。
 */
async function extractImageColors(url: string, maxDimension: number): Promise<ImageColors> {
  if (!url.trim()) throw new Error("图片 URL 不能为空");
  if (!Number.isInteger(maxDimension) || maxDimension <= 0) {
    throw new Error("maxDimension 必须是正整数");
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!response.ok) throw new Error(`图片加载失败：HTTP ${response.status}（${url}）`);

  const bitmap = await createImageBitmap(await response.blob());
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height, maxDimension);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("无法创建 OffscreenCanvas 2D Context");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const { data } = context.getImageData(0, 0, width, height);
    // 释放像素缓冲区
    canvas.width = 0;
    canvas.height = 0;

    return colorsFromPixels(data);
  } finally {
    bitmap.close();
  }
}

/** 按最大边长等比缩放，且不小于 1px */
function fitSize(width: number, height: number, maxDimension: number) {
  if (!width || !height) throw new Error("图片尺寸无效");
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function colorsFromPixels(data: Uint8ClampedArray): ImageColors {
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 255) {
      pixels.push(argbFromRgb(data[i]!, data[i + 1]!, data[i + 2]!));
    }
  }
  if (!pixels.length) throw new Error("图片没有可用于取色的不透明像素");

  const quantized = QuantizerCelebi.quantize(pixels, 128);
  const [seed] = Score.score(quantized, { desired: 1 });
  if (seed === undefined) throw new Error("无法从图片中提取有效颜色");

  // CSS 背景使用封面原有的候选色，优先采用来自图片的主题种子色。
  const candidates = [...quantized.entries()].sort((a, b) => b[1] - a[1]).map(([argb]) => argb);
  const coverColors = (
    quantized.has(seed) ? [seed, ...candidates.filter((argb) => argb !== seed)] : candidates
  )
    .slice(0, COVER_COLOR_LIMIT)
    .map(hexFromArgb);

  const { palettes } = themeFromSourceColor(seed);
  return {
    coverColors,
    palettes: Object.fromEntries(
      MONET_PALETTES.map((name) => [name, serializePalette(palettes[name])])
    ) as Record<MonetPaletteName, TonalColors>
  };
}

function serializePalette(palette: { tone(tone: number): number }): TonalColors {
  const entries = MONET_TONES.map((tone) => [tone, hexFromArgb(palette.tone(tone))] as const);
  return Object.fromEntries(entries) as TonalColors;
}
