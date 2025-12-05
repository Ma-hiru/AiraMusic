import { FC, memo, RefObject, useRef, HTMLAttributes, useEffect } from "react";
import { SpectrumOptions, useSpectrum } from "@mahiru/ui/hook/useSpectrum";

type SpectrumCanvasProps = HTMLAttributes<HTMLCanvasElement> & {
  audioRef: RefObject<Nullable<HTMLAudioElement>>;
  isPlaying: boolean;
  color?: string;
  gap?: number;
  spectrumOptions?: SpectrumOptions;
};

const SpectrumCanvas: FC<SpectrumCanvasProps> = ({
  audioRef,
  color = "#00ffaa",
  gap = 2,
  isPlaying,
  spectrumOptions,
  ...rest
}) => {
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const { spectrumData, isReady } = useSpectrum(audioRef, isPlaying, {
    fftSize: 2048,
    numBands: 32, // 减少到32个频段，避免拥挤
    withPeaks: false,
    ...spectrumOptions
  });
  useEffect(() => {
    if (!isReady || !isPlaying) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let animationFrameId: number;
    const draw = () => {
      const { bands } = spectrumData.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const count = bands.length;
      const width = canvas.width;
      const height = canvas.height;
      if (!count) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }
      const totalGap = gap * Math.max(0, count - 1);
      const availableWidth = Math.max(1, width - totalGap);
      const barWidth = availableWidth / count;

      for (let i = 0; i < count; i++) {
        const value = bands[i] ?? 0;
        const normalized = Math.min(1, Math.max(0, value));
        const barHeight = Math.max(2, normalized * height);
        const x = i * (barWidth + gap);
        const y = height - barHeight;

        // 渐变色：从底部绿色到顶部黄色
        const gradient = ctx.createLinearGradient(x, height, x, y);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.6, color);
        gradient.addColorStop(1, "#ffff00"); // 顶部黄色高光

        ctx.fillStyle = gradient;
        const radius = Math.min(3, barWidth / 2, barHeight / 2);

        if (radius > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };
    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [color, gap, isPlaying, isReady, spectrumData]);
  return <canvas ref={canvasRef} {...rest} />;
};
export default memo(SpectrumCanvas);
