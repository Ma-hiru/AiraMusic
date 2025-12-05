import { FC, HTMLAttributes, memo, RefObject, useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";
import { useSpectrum } from "@mahiru/ui/hook/useSpectrum";

type SpectrumPixiProps = HTMLAttributes<HTMLCanvasElement> & {
  audioRef: RefObject<Nullable<HTMLAudioElement>>;
  isPlaying: boolean;
  color?: string;
  gap?: number;
};

const SpectrumPixi: FC<SpectrumPixiProps> = ({
  audioRef,
  color = "#00ffaa",
  gap = 2,
  isPlaying,
  ...rest
}) => {
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const { spectrumData, isReady } = useSpectrum(audioRef, isPlaying, {
    fftSize: 2048,
    numBands: 32, // 减少到32个频段
    withPeaks: false
  });

  useEffect(() => {
    if (!isReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const app = new Application();

    const initApp = async () => {
      await app.init({
        canvas,
        width: canvas.width,
        height: canvas.height,
        background: 0x000000
      });
      if (disposed) return;
      const graphics = new Graphics();
      app.stage.addChild(graphics);
      const fillColor = color.startsWith("#") ? parseInt(color.slice(1), 16) : Number(color);

      app.ticker.add(() => {
        const bands = spectrumData.current.bands;
        const count = bands.length;
        const width = canvas.width;
        const height = canvas.height;

        graphics.clear();

        if (!count) {
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

          // 底部到顶部渐变
          const bottomColor = Number.isFinite(fillColor) ? fillColor : 0x00ffaa;
          const topColor = 0xffff00; // 黄色高光

          // 简化版渐变：根据高度混合颜色
          const ratio = normalized;
          const r1 = (bottomColor >> 16) & 0xff;
          const g1 = (bottomColor >> 8) & 0xff;
          const b1 = bottomColor & 0xff;
          const r2 = (topColor >> 16) & 0xff;
          const g2 = (topColor >> 8) & 0xff;
          const b2 = topColor & 0xff;

          const mixedR = Math.floor(r1 + (r2 - r1) * ratio);
          const mixedG = Math.floor(g1 + (g2 - g1) * ratio);
          const mixedB = Math.floor(b1 + (b2 - b1) * ratio);
          const mixedColor = (mixedR << 16) | (mixedG << 8) | mixedB;

          graphics.beginFill(mixedColor);

          const radius = Math.min(3, barWidth / 2, barHeight / 2);
          graphics.drawRoundedRect(x, y, barWidth, barHeight, radius);
          graphics.endFill();
        }
      });
    };

    void initApp();

    return () => {
      disposed = true;
      app.destroy(true);
    };
  }, [color, gap, isReady, spectrumData]);

  return <canvas ref={canvasRef} {...rest} />;
};

export default memo(SpectrumPixi);
