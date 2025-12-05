import { FC, memo, RefObject, useRef, HTMLAttributes, useEffect } from "react";
import { SpectrumOptions, useSpectrum } from "@mahiru/ui/hook/useSpectrum";

type SpectrumCanvasProps = HTMLAttributes<HTMLCanvasElement> & {
  audioRef: RefObject<Nullable<HTMLAudioElement>>;
  isPlaying: boolean;
  color?: string;
  secondaryColor?: string;
  gap?: number;
  barWidth?: number;
  spectrumOptions?: SpectrumOptions;
};

const SpectrumCanvas: FC<SpectrumCanvasProps> = ({
  audioRef,
  color = "#00ffaa",
  gap = 2,
  isPlaying,
  spectrumOptions,
  secondaryColor = "#00ffaa",
  barWidth,
  ...rest
}) => {
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const { spectrumData, isReady } = useSpectrum(audioRef, isPlaying, {
    fftSize: 2048,
    numBands: 32,
    withPeaks: false,
    ...spectrumOptions
  });
  useEffect(() => {
    if (!isReady || !isPlaying) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // 确保画布像素尺寸与显示尺寸一致（考虑设备像素比）
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    const targetW = Math.max(1, cssW * dpr);
    const targetH = Math.max(1, cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    // 每次绘制前重置变换，避免累计缩放导致位置错误
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let animationFrameId: number;
    const draw = () => {
      const { bands } = spectrumData.current;
      // 在 CSS 坐标系下清空
      ctx.clearRect(0, 0, cssW, cssH);
      const count = bands.length;
      const width = cssW;
      const height = cssH;
      if (!count) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }
      const totalGap = gap * Math.max(0, count - 1);
      let computedBarWidth: number;
      if (typeof barWidth === "number" && barWidth > 0) {
        // 使用用户指定的柱宽（CSS 像素）
        computedBarWidth = Math.max(1, Math.floor(barWidth));
      } else {
        const availableWidth = Math.max(1, width - totalGap);
        computedBarWidth = Math.max(2, Math.floor(availableWidth / count));
      }
      for (let i = 0; i < count; i++) {
        const value = bands[i] ?? 0;
        const barHeight = Math.max(2, value * height);
        const x = i * (computedBarWidth + gap);
        const y = height - barHeight;

        const gradient = ctx.createLinearGradient(x, height, x, y);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.6, color);
        gradient.addColorStop(1, secondaryColor);
        ctx.fillStyle = gradient;
        const radius = Math.min(3, Math.floor(computedBarWidth / 2), Math.floor(barHeight / 2));

        if (radius > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, computedBarWidth, barHeight, [radius, radius, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, computedBarWidth, barHeight);
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };
    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [barWidth, color, gap, isPlaying, isReady, secondaryColor, spectrumData]);
  return <canvas ref={canvasRef} {...rest} />;
};
export default memo(SpectrumCanvas);
