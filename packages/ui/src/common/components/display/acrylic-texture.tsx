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
    context.filter = `blur(${Math.max(0, blur) * scale}px) brightness(${brightness}) saturate(${saturate})`;
    context.drawImage(source, 0, 0);
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
