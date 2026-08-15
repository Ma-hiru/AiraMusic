import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  startTransition,
  type SyntheticEvent,
  type ImgHTMLAttributes,
  type MouseEvent as ReactMouseEvent
} from "react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseServicesImage } from "@/common/netease/services";
import { NeteaseLocalImage, NeteaseNetworkImage } from "@/common/netease/models";

type ShadowLevel = "base" | "none" | "float";

type ShadowColor = "dark" | "light";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  cache: boolean;
  pause?: boolean;
  preview?: boolean;
  cacheLazy?: boolean;
  draggable?: boolean;
  retryCount?: number;
  retryDelay?: number;
  fallback?: ReactNode;
  shadow?: ShadowLevel;
  retryOnError?: boolean;
  imageClassName?: string;
  shadowColor?: ShadowColor;
  image: Optional<NeteaseLocalImage | NeteaseNetworkImage>;
  cacheLazyProps?: {
    threshold?: number;
    rootMargin?: string;
    root?: null | Element;
  };
};

const NeteaseImage: FC<ImageProps> = ({
  className,
  onClick,
  onError,
  alt,
  cache,
  image,
  pause,
  preview,
  fallback,
  cacheLazyProps,
  imageClassName,
  retryCount = 2,
  shadow = "base",
  cacheLazy = true,
  loading = "lazy",
  retryDelay = 500,
  draggable = false,
  decoding = "async",
  retryOnError = true,
  shadowColor = "light",
  ...rest
}) => {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<Nullable<NeteaseLocalImage | NeteaseNetworkImage>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const retryStatus = useRef({
    token: 0,
    count: 0,
    retryCount,
    retryDelay
  });
  retryStatus.current.retryCount = retryCount;
  retryStatus.current.retryDelay = retryDelay;

  const retry = useCallback((imageElement: HTMLImageElement) => {
    if (!imageElement.isConnected) return; // 图片已不在文档中，停止重试
    if (imageElement.complete && imageElement.naturalWidth > 0) return; // 图片已加载成功，停止重试
    const { count, retryCount, retryDelay } = retryStatus.current;
    if (count >= retryCount) return; // 达到最大重试次数，停止重试

    const token = Date.now();
    // Full Jitter
    const delay = Math.random() * retryDelay * (count + 1);
    const canRun = (cb: NormalFunc) => {
      if (!imageElement.isConnected) return;
      else if (token !== retryStatus.current.token) return;
      else if (imageElement.complete && imageElement.naturalWidth > 0) return;
      cb();
    };
    const exec = () => {
      retryStatus.current.count += 1;
      const newURL = new URL(imageElement.src);
      newURL.searchParams.set("timestamp", Date.now().toString());
      imageElement.src = newURL.toString();
      setError(false);
    };

    retryStatus.current.token = token;
    setTimeout(() => {
      requestIdleCallback(() => canRun(exec), {
        timeout: 200
      });
    }, delay);
  }, []);

  // 图片加载错误处理
  const handleLoadError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      if (source?.isLocal() && image) {
        void NeteaseServicesImage.remove(image);
        return setSource(image.toNetworkImage());
      } else if (source?.isNetwork() && retryOnError) {
        return retry(e.currentTarget);
      }
      return onError?.(e);
    },
    [image, onError, retry, retryOnError, source]
  );

  const wrapClick = useCallback(
    async (e: ReactMouseEvent<HTMLImageElement>) => {
      if (preview && image) {
        const sendImage = image.toNetworkImage().setSize(NeteaseImageSize.raw);
        await RendererWindow.image.reactReadyAwait();
        RendererIPCMessageBus.preview.deliver({
          url: sendImage.src,
          alt: alt || sendImage.alt
        });
      }
      return onClick?.(e);
    },
    [alt, image, onClick, preview]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          startTransition(() => setVisible(true));
          observer.unobserve(entry.target);
        }
      },
      {
        root: null, // viewport
        rootMargin: "200px", // 提前加载（关键）
        threshold: 0,
        ...cacheLazyProps
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [cacheLazyProps]);

  useEffect(() => {
    if (pause || !image?.src || (cacheLazy && !visible)) return;
    NeteaseServicesImage.local(image, cache).then((local) => {
      if (local) setSource(local);
      else setSource(image);
    });
  }, [cache, cacheLazy, image, pause, visible]);

  // src变化时重置错误状态和重试状态
  useEffect(() => {
    setError(false);
    setSource(null);
    const status = retryStatus.current;
    status.count = 0;
    status.token = Date.now();
    return () => {
      status.token = Date.now();
    };
  }, [image?.src]);

  const shadowBaseLight = shadow === "base" && shadowColor === "light";
  const shadowBaseDark = shadow === "base" && shadowColor === "dark";
  const shadowFloatLight = shadow === "float" && shadowColor === "light";
  const shadowFloatDark = shadow === "float" && shadowColor === "dark";
  return (
    <span
      ref={containerRef}
      className={cx(
        "overflow-hidden block",
        error && !fallback && "bg-white/10 backdrop-blur-sm",
        shadowBaseDark && "shadow-sm",
        shadowBaseLight && "shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
        shadowFloatDark && "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)]",
        shadowFloatLight && "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.18)]",
        className
      )}
      onClick={wrapClick}>
      <img
        {...rest}
        className={cx("w-full h-full object-cover", error && "invisible w-0 h-0", imageClassName)}
        loading={loading}
        src={source?.src}
        decoding={decoding}
        draggable={draggable}
        alt={alt ?? source?.alt}
        onError={handleLoadError}
      />
      {error && fallback}
    </span>
  );
};

export default memo(NeteaseImage);
