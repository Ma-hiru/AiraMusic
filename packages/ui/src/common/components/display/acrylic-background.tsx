import { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css, cx, keyframes } from "@emotion/css";
import RendererTheme from "@/common/player/ui";
import Color from "color";

interface AcrylicBackgroundProps {
  src?: string;
  alt?: string;
  blur?: number;
  opacity?: number;
  className?: string;
  brightness?: number;
  saturate?: number;
  duration?: number;
  /** 流体背景：封面色彩缓慢旋转漂移。仅 transform/opacity 合成动画，模糊只栅格化一次。默认关闭 */
  fluid?: boolean;
  /** 流体速度倍率，1 为默认，越大越快。运行时修改会导致相位跳变 */
  fluidSpeed?: number;
  /** 暂停流体动画。冻结当前相位，恢复时从原位继续（无闪烁），暂停期间合成器不重绘，可与播放状态联动省电 */
  fluidPaused?: boolean;
  /** 自适应蒙版所需要的颜色集合：封面越亮，蒙版越浓，保证白字在亮封面下的可读性*/
  themeColors?: readonly string[];
  /**
   * 蒙版颜色取封面深色调（非纯黑），压暗的同时保留专辑色倾向，避免发灰
   * 调低 FACTOR / MAX 可让背景更通透（亮封面下文字对比度也随之下降）
   * */
  scrim_factor?: number;
  scrim_max?: number;
  /**
   *  背景双色渐变透明度
   *  调高更明显但更亮（亮封面下可读性下降）
   * */
  gradient_alpha?: number;
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

const fadeIn = keyframes`
  from { opacity: 0; }
`;

// 圆形色斑：旋转时不会露出矩形边角，重模糊把圆形边缘融进底图；screen 混合让色彩发光而非平铺
const fluidLayerCls = css`
  position: absolute;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  object-fit: cover;
  pointer-events: none;
  mix-blend-mode: screen;
  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

interface FluidBlob {
  animation: string;
  /** 周期（秒），fluidSpeed = 1 时的值 */
  cycle: number;
  /** 负延迟错开各层初始相位 */
  delay: number;
  blurScale: number;
  brightnessScale: number;
  opacityScale: number;
  pos: { width: string } & Partial<Record<"left" | "right" | "top" | "bottom", string>>;
}

const FLUID_BLOBS: FluidBlob[] = [
  {
    animation: drift,
    cycle: 42,
    delay: -7,
    blurScale: 1.4,
    brightnessScale: 1.5,
    opacityScale: 1,
    pos: { width: "72%", left: "-16%", top: "-24%" }
  },
  {
    animation: driftReverse,
    cycle: 58,
    delay: -23,
    blurScale: 1.6,
    brightnessScale: 1.3,
    opacityScale: 1,
    pos: { width: "85%", right: "-22%", bottom: "-32%" }
  },
  {
    animation: driftSlow,
    cycle: 73,
    delay: -41,
    blurScale: 1.2,
    brightnessScale: 1.6,
    opacityScale: 0.75,
    pos: { width: "55%", left: "28%", top: "30%" }
  }
];

const imgClasses = "absolute inset-0 w-full h-full object-cover scale-110";

const AcrylicBackground: FC<AcrylicBackgroundProps> = ({
  src,
  blur = 40,
  opacity = 0.35,
  alt,
  className,
  brightness = 0.5,
  saturate = 1.8,
  duration = 800,
  fluid = false,
  fluidSpeed = 1,
  fluidPaused = false,
  themeColors,
  scrim_factor = 0.3,
  scrim_max = 0.28,
  gradient_alpha = 0.5
}) => {
  const [current, setCurrent] = useState(src);
  const [next, setNext] = useState<string>();
  const [stage, setStage] = useState<"idle" | "fade">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (src === current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!src) {
      setCurrent(undefined);
      setNext(undefined);
    } else {
      setNext(src);
    }
    setStage("idle");
  }, [current, src]);

  // 组件卸载时清理定时器，避免内存泄漏
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleLoad = useCallback(() => {
    // 双重 rAF 确保 opacity: 0 已提交，transition 才能生效
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStage("fade");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCurrent(next);
          setNext(undefined);
          setStage("idle");
        }, duration);
      });
    });
  }, [duration, next]);

  // 加载失败保留旧图
  const handleError = useCallback(() => {
    setNext(undefined);
    setStage("idle");
  }, []);

  // saturate 原由毛玻璃层的 backdrop-filter 提供，并入图片 filter 后效果一致且免去每帧重采样
  const imgFilter = `blur(${blur}px) brightness(${brightness}) saturate(${saturate})`;
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

  return (
    <div className={cx("relative w-full h-full overflow-hidden", fluid && "isolate", className)}>
      {/* 当前背景：仅在交叉淡化阶段开启 transition，提交新图时直接跳变（与淡入层像素一致，无闪烁） */}
      {current && (
        <img
          src={current}
          decoding="async"
          draggable={false}
          alt={alt ?? ""}
          className={imgClasses}
          style={{
            transition: stage === "fade" ? `opacity ${duration}ms ease` : "none",
            opacity: stage === "fade" ? 0 : opacity,
            filter: imgFilter
          }}
        />
      )}
      {/* 下一张：加载完成后才开始交叉淡化，加载期间旧图保持可见 */}
      {next && (
        <img
          src={next}
          key={next}
          decoding="async"
          draggable={false}
          alt=""
          onLoad={handleLoad}
          onError={handleError}
          className={imgClasses}
          style={{
            transition: `opacity ${duration}ms ease`,
            opacity: stage === "fade" ? opacity : 0,
            filter: imgFilter
          }}
        />
      )}
      {/* 流体层：三个轨道运动的封面色斑。play-state 只作用于漂移动画，换图淡入不受暂停影响 */}
      {fluid &&
        current &&
        FLUID_BLOBS.map((blob, i) => (
          <img
            key={`fluid-${i}-${current}`}
            src={current}
            aria-hidden
            alt=""
            decoding="async"
            draggable={false}
            className={fluidLayerCls}
            style={{
              ...blob.pos,
              opacity: fluidOpacity * blob.opacityScale,
              filter: `blur(${blur * blob.blurScale}px) brightness(${brightness * blob.brightnessScale}) saturate(2)`,
              animation: `${fadeIn} ${duration}ms ease both, ${blob.animation} ${blob.cycle / speed}s linear ${blob.delay / speed}s infinite`,
              animationPlayState: `running, ${fluidPaused ? "paused" : "running"}`
            }}
          />
        ))}
      {/* 轻微提亮，替代原 backdrop-filter 毛玻璃层 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "rgba(255, 255, 255, 0.05)" }}
      />
      {scrim && (
        <div className="pointer-events-none absolute inset-0" style={{ background: scrim }} />
      )}
      {heroGradient && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: heroGradient }}
        />
      )}
    </div>
  );
};

export default memo(AcrylicBackground);
