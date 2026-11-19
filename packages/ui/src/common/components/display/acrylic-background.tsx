import { cx, css, keyframes } from "@emotion/css";
import { memo, useRef, type FC, useMemo, useState, useEffect } from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenResize } from "@/common/hooks/use-listen-resize";
import { useWindowVisible } from "@/common/hooks/use-window-visible";
import Color from "color";
import RendererTheme from "@/common/player/ui";

import AcrylicTexture from "./acrylic-texture";
import AcrylicFluidShader from "./acrylic-fluid-shader";

interface AcrylicBackgroundProps {
  alt?: string;
  src?: string;
  /** 着色器仅在初始化时读取模糊参数 */
  blur?: number;
  opacity?: number;
  /** 换图淡入时长（毫秒），着色器仅在初始化时读取 */
  duration?: number;
  /** CSS 路径的饱和度，着色器使用固定调色 */
  saturate?: number;
  className?: string;
  /** CSS 路径的亮度，着色器使用固定调色 */
  brightness?: number;
  /** 流体背景：预处理封面纹理后，仅通过 transform/opacity 漂移和换图。默认关闭 */
  fluid?: boolean;
  /**
   * 流体背景的渲染方式：
   * - `css`（默认）：三层预烘焙色斑做 transform 漂移，零 WebGL 依赖；
   * - `shader`：低分辨率场景做多尺度叠加、旋涡和后模糊，
   *   关闭 fluid 时保留静态画面，不可用或上下文丢失时自动回退到 `css`。
   */
  fluidMode?: "css" | "shader";
  /** 流体速度倍率，1 为默认，越大越快。运行时修改会导致相位跳变 */
  fluidSpeed?: number;
  /** 暂停漂移动画，保留当前相位；换图淡入不受暂停影响 */
  fluidPaused?: boolean;
  /** 自适应蒙版所需要的颜色集合：封面越亮，蒙版越浓，保证白字在亮封面下的可读性*/
  themeColors?: readonly string[];
  /**
   * 蒙版颜色取封面深色调（非纯黑），压暗的同时保留专辑色倾向，避免发灰
   * 调低 FACTOR / MAX 可让背景更通透（亮封面下文字对比度也随之下降）
   * */
  scrim_max?: number;
  scrim_factor?: number;
  /**
   *  背景双色渐变透明度
   *  调高更明显但更亮（亮封面下可读性下降）
   * */
  gradient_alpha?: number;
  onLoaded?: NormalFunc;
}

// 公转（translate 跟随 rotate 形成轨道）+ 自转 + 呼吸缩放，比纯旋转的动感明显得多
const drift = keyframes`
  0% { transform: rotate(0turn) translate(5%, 0) scale(1); }
  50% { transform: rotate(0.5turn) translate(5%, 0) scale(1.25); }
  100% { transform: rotate(1turn) translate(5%, 0) scale(1); }
`;

const driftReverse = keyframes`
  0% { transform: rotate(1turn) translate(-6%, 0) scale(1.15); }
  50% { transform: rotate(0.5turn) translate(-6%, 0) scale(1); }
  100% { transform: rotate(0turn) translate(-6%, 0) scale(1.15); }
`;

const driftSlow = keyframes`
  0% { transform: rotate(0turn) translate(0, 6%) scale(1.1); }
  50% { transform: rotate(0.5turn) translate(0, 6%) scale(0.95); }
  100% { transform: rotate(1turn) translate(0, 6%) scale(1.1); }
`;

// 圆形与模糊已写入纹理，动画层只负责漂移和颜色叠加。
const fluidLayerCls = css`
  position: absolute;
  aspect-ratio: 1 / 1;
  pointer-events: none;
  mix-blend-mode: screen;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

interface FluidBlob {
  width: number;
  animation: string;
  /** 周期（秒），fluidSpeed = 1 时的值 */
  cycle: number;
  /** 负延迟错开各层初始相位 */
  delay: number;
  blurScale: number;
  opacityScale: number;
  brightnessScale: number;
  pos: Partial<Record<"top" | "left" | "right" | "bottom", string>>;
}

const FLUID_BLOBS: FluidBlob[] = [
  {
    width: 72,
    animation: drift,
    cycle: 42,
    delay: -7,
    blurScale: 1.4,
    brightnessScale: 1.5,
    opacityScale: 1,
    pos: { left: "-16%", top: "-24%" }
  },
  {
    width: 85,
    animation: driftReverse,
    cycle: 58,
    delay: -23,
    blurScale: 1.6,
    brightnessScale: 1.3,
    opacityScale: 1,
    pos: { right: "-22%", bottom: "-32%" }
  },
  {
    width: 55,
    animation: driftSlow,
    cycle: 73,
    delay: -41,
    blurScale: 1.2,
    brightnessScale: 1.6,
    opacityScale: 0.75,
    pos: { left: "28%", top: "30%" }
  }
];

interface BackgroundCover {
  src: string;
  image: HTMLImageElement;
}

const AcrylicBackground: FC<AcrylicBackgroundProps> = ({
  className,
  onLoaded,
  alt,
  src,
  blur = 40,
  themeColors,
  fluid = false,
  duration = 800,
  fluidSpeed = 1,
  opacity = 0.35,
  saturate = 1.8,
  brightness = 0.5,
  scrim_max = 0.28,
  fluidMode = "css",
  scrim_factor = 0.3,
  gradient_alpha = 0.5,
  fluidPaused: _fluidPaused = false
}) => {
  const visible = useWindowVisible();
  const fluidPaused = !visible || _fluidPaused;

  const containerRef = useRef<HTMLDivElement>(null);
  const sizeListener = useListenResize(containerRef);
  const size = useMemo(() => {
    void sizeListener;
    return {
      width: containerRef.current?.clientWidth || window.innerWidth,
      height: containerRef.current?.clientHeight || window.innerHeight
    };
  }, [sizeListener]);
  const [current, setCurrent] = useState<BackgroundCover>();
  const [next, setNext] = useState<BackgroundCover>();
  const [shaderCover, setShaderCover] = useState<BackgroundCover>();
  const [stage, setStage] = useState<"fade" | "idle">("idle");
  const [shaderFailed, setShaderFailed] = useState(false);
  const currentRef = useLatestRef(current);
  const onLoadedRef = useLatestRef(onLoaded);

  useEffect(() => {
    setNext(undefined);
    setStage("idle");
    if (!src) {
      setCurrent(undefined);
      setShaderCover(undefined);
      return;
    }
    if (src === currentRef.current?.src) {
      setShaderCover(currentRef.current);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image
      .decode()
      .then(() => {
        if (cancelled) return;
        const cover = { src, image };
        // 着色器自己处理淡入。下一张封面解码期间继续使用这张图。
        setShaderCover(cover);
        if (currentRef.current) setNext(cover);
        else setCurrent(cover);
        onLoadedRef.current?.();
      })
      .catch(() => {
        // 加载失败保留旧图。
      });
    return () => {
      cancelled = true;
    };
  }, [currentRef, onLoadedRef, src]);

  useEffect(() => {
    if (!next) return;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    // 等待透明的新纹理提交后，再一起淡入底图与色斑。
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setStage("fade");
        timer = setTimeout(() => {
          setCurrent(next);
          setNext(undefined);
          setStage("idle");
        }, duration);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [duration, next]);

  const fluidOpacity = Math.min(1, opacity * 1.4);
  const speed = Math.max(0.1, fluidSpeed);

  // 蒙版浓度随封面平均亮度
  const scrim = useMemo(() => {
    if (!themeColors) return undefined;
    const alpha = Math.min(scrim_max, RendererTheme.avgLuminance(themeColors) * scrim_factor);
    const mainColor = themeColors.at(0) || RendererTheme.themeDefault.main;
    return RendererTheme.generatePalette(mainColor)[900].alpha(alpha).string();
  }, [scrim_factor, scrim_max, themeColors]);

  // 背景双色渐变 main→secondary
  const heroGradient = useMemo(() => {
    if (!themeColors?.at(0)) return undefined;
    // 取色相离主色最远的一对
    const [c1, c2] = RendererTheme.pickGradientColors(themeColors);
    const a = Color(c1).alpha(gradient_alpha).string();
    const b = Color(c2).alpha(gradient_alpha).string();
    return `linear-gradient(-135deg, ${a} 0%, ${b} 100%)`;
  }, [gradient_alpha, themeColors]);

  const useShader = fluidMode === "shader" && !shaderFailed && !!shaderCover;
  const imageLabel = useShader || current || next ? alt : undefined;

  return (
    <div
      ref={containerRef}
      className={cx("relative w-full h-full overflow-hidden", className)}
      aria-label={imageLabel}
      role={imageLabel ? "img" : undefined}>
      {useShader && shaderCover && (
        // Shader 路径输出完整、已压暗的场景，使用 Apple 风格的独立调色。
        // 再叠 CSS opacity / 静态双色渐变会压平流动色块，并重新放大色带。
        <div className="absolute inset-0">
          <AcrylicFluidShader
            className="block w-full h-full"
            blur={blur}
            opacity={1}
            speed={speed}
            saturate={2.75}
            brightness={0.7}
            duration={duration}
            image={shaderCover.image}
            paused={fluidPaused || !fluid}
            onUnsupported={() => setShaderFailed(true)}
          />
        </div>
      )}
      {!useShader &&
        [current, next].map(
          (cover) =>
            cover && (
              <div
                key={cover.src}
                className={cx("absolute inset-0", fluid && "isolate")}
                style={{
                  transition: stage === "fade" ? `opacity ${duration}ms ease` : "none",
                  opacity: cover === current ? (stage === "fade" ? 0 : 1) : stage === "fade" ? 1 : 0
                }}>
                <div className="absolute inset-0 scale-110" style={{ opacity }}>
                  <AcrylicTexture
                    blur={blur}
                    width={size.width}
                    image={cover.image}
                    saturate={saturate}
                    height={size.height}
                    brightness={brightness}
                  />
                </div>
                {fluid &&
                  FLUID_BLOBS.map((blob, i) => (
                    <div
                      key={i}
                      className={fluidLayerCls}
                      style={{
                        ...blob.pos,
                        width: `${blob.width}%`,
                        opacity: fluidOpacity * blob.opacityScale,
                        animationName: blob.animation,
                        animationDuration: `${blob.cycle / speed}s`,
                        animationDelay: `${blob.delay / speed}s`,
                        animationPlayState: fluidPaused ? "paused" : "running"
                      }}>
                      <AcrylicTexture
                        saturate={2}
                        image={cover.image}
                        blur={blur * blob.blurScale}
                        width={(size.width * blob.width) / 100}
                        height={(size.width * blob.width) / 100}
                        brightness={brightness * blob.brightnessScale}
                        round
                      />
                    </div>
                  ))}
              </div>
            )
        )}
      {/* 轻微提亮，替代原 backdrop-filter 毛玻璃层 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      />
      {!useShader && scrim && (
        <div className="pointer-events-none absolute inset-0" style={{ background: scrim }} />
      )}
      {!useShader && heroGradient && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: heroGradient }}
        />
      )}
    </div>
  );
};

export default memo(AcrylicBackground);
