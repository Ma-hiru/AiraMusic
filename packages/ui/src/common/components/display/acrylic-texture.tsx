import { memo, useRef, type FC, useLayoutEffect } from "react";

interface AcrylicTextureProps {
  blur: number;
  width: number;
  height: number;
  round?: boolean;
  saturate: number;
  brightness: number;
  image: HTMLImageElement;
}

// 背景已经重度模糊，无需按窗口尺寸或 DPR 分配纹理。
const MAX_TEXTURE_SIZE = 512;

/**
 * WKWebView（Safari/WebKit）没有 `CanvasRenderingContext2D.filter`，
 * 直接写 `ctx.filter = "blur(...)"` 会被静默忽略 —— 纹理会保持锐利，
 * 再经父层的 `mix-blend-mode: screen` 叠加，就是「整屏橙色泛光 + 还能看清封面」的观感。
 *
 * 替代方案：把同样的滤镜链搬到 canvas 元素的 CSS `filter` 上。
 * - CSS blur 是真正的（GPU）高斯，观感与 Chromium 的 ctx.filter 基本一致；
 * - 不读取像素，因此跨域封面不会触发 canvas taint 限制（getImageData 会抛错）。
 *
 * 注意 `blurDisplayPx` 必须是**显示空间**的像素值：ctx.filter 的半径会被纹理缩放
 * 放大，而 CSS blur 直接作用在元素最终尺寸上，两者需要换算，否则会明显偏弱。
 */
function paintAcrylic(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  blurCanvasPx: number,
  blurDisplayPx: number,
  brightness: number,
  saturate: number
) {
  const canvas = context.canvas;

  if (Reflect.has(context, "filter")) {
    canvas.style.filter = "";
    context.filter = `blur(${blurCanvasPx}px) brightness(${brightness}) saturate(${saturate})`;
    context.drawImage(source, 0, 0);
    return;
  }

  context.drawImage(source, 0, 0);
  canvas.style.filter = `blur(${blurDisplayPx}px) brightness(${brightness}) saturate(${saturate})`;
}

const AcrylicTexture: FC<AcrylicTextureProps> = ({
  blur,
  image,
  width,
  height,
  saturate,
  brightness,
  round = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padding = Math.max(0, blur) * 3;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const scale = Math.min(
      1,
      MAX_TEXTURE_SIZE / Math.max(width + padding * 2, height + padding * 2)
    );
    canvas.width = Math.max(1, Math.ceil((width + padding * 2) * scale));
    canvas.height = Math.max(1, Math.ceil((height + padding * 2) * scale));
    const context = canvas.getContext("2d");
    if (!context) return;

    const source = document.createElement("canvas");
    source.width = canvas.width;
    source.height = canvas.height;
    const sourceContext = source.getContext("2d");
    if (!sourceContext) return;

    const x = padding * scale;
    const y = padding * scale;
    const w = width * scale;
    const h = height * scale;
    sourceContext.beginPath();
    if (round) sourceContext.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    else sourceContext.rect(x, y, w, h);
    sourceContext.clip();

    // 与 object-fit: cover 一致；先裁出色斑，再模糊，让边缘自然融入底图。
    const fit = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const imageWidth = image.naturalWidth * fit;
    const imageHeight = image.naturalHeight * fit;
    sourceContext.drawImage(
      image,
      x + (w - imageWidth) / 2,
      y + (h - imageHeight) / 2,
      imageWidth,
      imageHeight
    );
    paintAcrylic(
      context,
      source,
      // Chromium：ctx.filter 作用于纹理坐标，需要乘缩放
      Math.max(0, blur) * scale,
      // WebKit：CSS blur 作用于元素最终尺寸，直接用显示空间半径
      Math.max(0, blur),
      brightness,
      saturate
    );
  }, [blur, brightness, height, image, padding, round, saturate, width]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        left: -padding,
        top: -padding,
        width: `calc(100% + ${padding * 2}px)`,
        height: `calc(100% + ${padding * 2}px)`
      }}
      aria-hidden
    />
  );
};

export default memo(AcrylicTexture);
