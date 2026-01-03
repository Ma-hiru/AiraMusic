import { FC, HTMLAttributes, memo, useEffect, useMemo, useRef } from "react";
import { SpectrumOptions } from "@mahiru/ui/hook/useSpectrumWorker";
import { IRenderer, RendererOptions } from "./renderers/IRenderer";
import { Canvas2DRenderer } from "./renderers/canvas2d";
import { WebGLRendererRust } from "./renderers/webgl-rust";
import { usePlayerStore } from "@mahiru/ui/store/player";

type AudioSpectrumProps = HTMLAttributes<HTMLCanvasElement> & {
  isPlaying: boolean;
  color?: string;
  secondaryColor?: string;
  gap?: number;
  barWidth?: number;
  roundedCorners?: "top" | "bottom" | "both" | "none";
  renderer?: "canvas" | "webgl-rust";
  spectrumOptions?: SpectrumOptions;
  heightScale?: number;
};

const AudioSpectrum: FC<AudioSpectrumProps> = ({
  color = "#ffffff",
  gap = 2,
  isPlaying,
  spectrumOptions,
  secondaryColor = "#ffffff",
  barWidth,
  roundedCorners = "top",
  renderer = "canvas",
  heightScale = 1,
  ...rest
}) => {
  const { SpectrumGetter, SetSpectrumOptions } = usePlayerStore([
    "SpectrumGetter",
    "SetSpectrumOptions"
  ]);
  const canvasRef = useRef<Nullable<HTMLCanvasElement>>(null);
  const rendererRef = useRef<Nullable<IRenderer>>(null);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const spectrum = SpectrumGetter();
  const spectrumDataGetterRef = useRef<typeof spectrum.data>(null);
  const spectrumReadyRef = useRef<boolean>(false);
  useEffect(() => {
    spectrumDataGetterRef.current = spectrum.data;
    spectrumReadyRef.current = spectrum.ready;
  }, [spectrum.data, spectrum.ready]);

  const rendererFactory = useMemo(() => {
    return () => (renderer === "webgl-rust" ? new WebGLRendererRust() : new Canvas2DRenderer());
  }, [renderer]);
  const rendererOptions = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    return {
      options: {
        width: cssW,
        height: cssH,
        dpr,
        color,
        gap,
        barWidth,
        secondaryColor,
        roundedCorners,
        heightScale
      } as RendererOptions,
      canvas
    };
  }, [barWidth, color, gap, heightScale, roundedCorners, secondaryColor]);
  // 初始化和销毁渲染器
  useEffect(() => {
    if (!rendererOptions) return;
    const render = rendererFactory();
    const { canvas, options } = rendererOptions;
    render.init(canvas, options);
    rendererRef.current = render;
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [rendererFactory, rendererOptions]);
  // 渲染循环
  useEffect(() => {
    let animationFrameId: number;
    const draw = () => {
      const spectrumDataGetter = spectrumDataGetterRef.current;
      if (!spectrumReadyRef.current || !playingRef.current || !spectrumDataGetter) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }
      const { bands } = spectrumDataGetter();
      if (bands.length) rendererRef.current?.draw(bands);
      animationFrameId = requestAnimationFrame(draw);
    };
    animationFrameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  // 更新频谱选项
  useEffect(() => {
    isPlaying && SetSpectrumOptions(spectrumOptions || null);
  }, [SetSpectrumOptions, isPlaying, spectrumOptions]);
  return <canvas ref={canvasRef} {...rest} />;
};
export default memo(AudioSpectrum);
