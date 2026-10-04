import { cx } from "@emotion/css";
import { ImageOff } from "lucide-react";
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
import { Log } from "@/common/lib/log";
import { NeteaseImageSize } from "@/common/enum";
import { RendererCache } from "@/common/lib/cache";
import { RendererWindow } from "@/common/lib/window";
import { isLocalhostHttpURL } from "@/common/utils/url";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseServicesImage } from "@/common/netease/services";
import { NeteaseURL, NeteaseLocalImage, NeteaseNetworkImage } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";

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
  showNotFoundTips?: boolean;
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
  showNotFoundTips = false,
  fallback = <ImageOff className="size-1/2 max-w-10" />,
  ...rest
}) => {
  const [ok, setOk] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [stopRetry, setStopRetry] = useState(false);
  const [source, setSource] = useState<Nullable<NeteaseLocalImage | NeteaseNetworkImage>>(null);
  const notFoundDetectRef = useRef(false);
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
    if (!imageElement.isConnected) return true; // 图片已不在文档中，停止重试
    if (imageElement.complete && imageElement.naturalWidth > 0) return true; // 图片已加载成功，停止重试
    const { count, retryCount, retryDelay } = retryStatus.current;
    if (count >= retryCount) return true; // 达到最大重试次数，停止重试

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
    };

    retryStatus.current.token = token;
    setTimeout(() => {
      requestIdleCallback(() => canRun(exec), {
        timeout: 200
      });
    }, delay);

    return false;
  }, []);

  const handleOnLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const onLoad = rest.onLoad;
      setError(false);
      setOk(true);
      return onLoad?.(e);
    },
    [rest.onLoad]
  );

  // 图片加载错误处理
  const handleLoadError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      setError(true);
      if (source?.isLocal() && image) {
        // local不存在会重新使用network
        void NeteaseServicesImage.remove(image);
        if (is_not_found_cover(image.url)) return setStopRetry(true);
        return setSource(image.toNetworkImage());
      } else if (source?.isNetwork() && retryOnError) {
        // network不存在就是404, 不再重试
        if (is_not_found_cover(source?.url)) return setStopRetry(true);
        return setStopRetry(retry(e.currentTarget));
      } else {
        setStopRetry(true);
      }
      return onError?.(e);
    },
    [image, onError, retry, retryOnError, source]
  );

  const wrapClick = useCallback(
    async (e: ReactMouseEvent<HTMLImageElement>) => {
      if (preview && image) {
        if (error && stopRetry) return AppToast.show({ type: "info", text: "图片加载失败" });
        const sendImage = image.toNetworkImage().setSize(NeteaseImageSize.raw);
        await RendererWindow.image.reactReadyAwait();
        RendererIPCMessageBus.preview.deliver({
          url: sendImage.src,
          alt: alt || sendImage.alt
        });
      }
      return onClick?.(e);
    },
    [alt, error, image, onClick, preview, stopRetry]
  );

  const notFoundToast = useCallback(() => {
    showNotFoundTips && AppToast.show({ type: "error", text: "封面可能被和谐了 (>_<｡)" });
  }, [showNotFoundTips]);

  // src变化时重置错误状态和重试状态
  useEffect(() => {
    setOk(false);
    setError(false);
    setSource(null);
    setStopRetry(false);
    notFoundDetectRef.current = false;
    const status = retryStatus.current;
    status.count = 0;
    status.token = Date.now();
    return () => {
      status.token = Date.now();
    };
  }, [image?.src]);

  // 懒加载
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

  // 加载缓存
  useEffect(() => {
    if (pause || !image?.src || (cacheLazy && !visible)) return;
    // 这里检查url，因为local的src是local地址
    if (is_not_found_cover(image.url)) {
      setError(true);
      setStopRetry(true);
      return notFoundToast();
    }
    NeteaseServicesImage.local(image, cache).then((local) => {
      if (local) setSource(local);
      else setSource(image);
    });
  }, [cache, cacheLazy, image, pause, notFoundToast, visible]);

  // 404检测
  useEffect(() => {
    if (!error || !stopRetry || notFoundDetectRef.current || source?.isLocal()) return;
    const url = source?.src;
    if (is_not_found_cover(url)) return;
    if (url && !isLocalhostHttpURL(url)) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => {
        fetch(url, { credentials: "include", signal: controller.signal })
          .then((response) => {
            if (response.status === 404) {
              notFoundToast();
              set_not_found_cover(url);
            }
          })
          .catch()
          .finally(() => (notFoundDetectRef.current = true));
      }, 50);
      return () => {
        controller.abort();
        window.clearTimeout(timer);
      };
    } else {
      notFoundDetectRef.current = true;
    }
  }, [error, notFoundToast, source, stopRetry]);

  const shadowBaseLight = shadow === "base" && shadowColor === "light";
  const shadowBaseDark = shadow === "base" && shadowColor === "dark";
  const shadowFloatLight = shadow === "float" && shadowColor === "light";
  const shadowFloatDark = shadow === "float" && shadowColor === "dark";

  return (
    <span
      ref={containerRef}
      className={cx(
        "overflow-hidden block",
        error && "flex justify-center items-center",
        !ok && "bg-white/10 backdrop-blur-sm",
        shadowBaseDark && "shadow-sm",
        shadowBaseLight && "shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
        shadowFloatDark && "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)]",
        shadowFloatLight && "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.18)]",
        className
      )}
      onClick={wrapClick}>
      {source && (
        <img
          {...rest}
          className={cx(
            "w-full h-full object-cover",
            error && "invisible! w-0! h-0!",
            imageClassName
          )}
          loading={loading}
          src={source?.src}
          decoding={decoding}
          draggable={draggable}
          alt={alt ?? source?.alt}
          onLoad={handleOnLoad}
          onError={handleLoadError}
        />
      )}
      {error && stopRetry && fallback}
    </span>
  );
};

export default memo(NeteaseImage);

const is_not_found_cover = (url?: string) => {
  if (!url) return true;
  url = NeteaseURL.setImageSize(url, NeteaseImageSize.raw);
  const ans = !!RendererCache.memory.getOne<Set<string>>("cover-not-found")?.has(url);
  ans && Log.info("NeteaseImage", "not found cover", url);
  return ans;
};

const set_not_found_cover = (url?: string) => {
  if (!url) return;
  url = NeteaseURL.setImageSize(url, NeteaseImageSize.raw);
  Log.info("NeteaseImage", "set not found cover", url);
  RendererCache.memory.setOne<Set<string>>(
    "cover-not-found",
    (RendererCache.memory.getOne<Set<string>>("cover-not-found") ?? new Set<string>()).add(url)
  );
};
