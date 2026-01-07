import {
  FC,
  ImgHTMLAttributes,
  memo,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { cx } from "@emotion/css";
import { AppScheme } from "@mahiru/ui/constants/scheme";
import { NeteaseImage as NeteaseImageUtils, NeteaseImageSize } from "@mahiru/ui/utils/image";

type ShadowLevel = "none" | "base" | "float";

type ShadowColor = "light" | "dark";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  update?: boolean;
  timeLimit?: number;
  method?: string;
  size?: NeteaseImageSize | number;
  imageClassName?: string;
  retryOnError?: boolean;
  retryDelay?: number;
  retryCount?: number;
  shadow?: ShadowLevel;
  shadowColor?: ShadowColor;
  pause?: boolean;
};

const NeteaseImage: FC<ImageProps> = ({
  update = false,
  timeLimit,
  method = "GET",
  src,
  alt,
  size = NeteaseImageSize.raw,
  onError,
  className,
  loading = "lazy",
  decoding = "async",
  imageClassName,
  retryCount = 2,
  retryDelay = 500,
  retryOnError = true,
  shadow = "base",
  shadowColor = "light",
  onClick,
  pause,
  ...rest
}) => {
  const [error, setError] = useState(false);
  const sizedURL = useMemo(() => NeteaseImageUtils.setSize(src, size), [size, src]);
  const cacheURL = pause ? undefined : NeteaseImageUtils.fetchCacheURL(sizedURL);
  const requestCache = useRef<Nullable<(controller?: AbortController) => void>>(null);
  const retryStatus = useRef({
    token: 0,
    count: 0,
    retryCount,
    retryDelay
  });
  retryStatus.current.retryCount = retryCount;
  retryStatus.current.retryDelay = retryDelay;

  const onCacheHit = useCallback(
    (file: string) => {
      NeteaseImageUtils.storeCacheURL(sizedURL, file);
    },
    [sizedURL]
  );
  const onCacheError = useCallback(() => {
    NeteaseImageUtils.storeCacheURL(sizedURL, null);
  }, [sizedURL]);
  const cachedCover = useFileCache(sizedURL, {
    onCacheHit,
    update,
    timeLimit,
    method,
    pause: !!cacheURL || pause,
    injectCacheRequest: (requestFunc) => {
      requestCache.current = requestFunc;
    }
  });

  const retry = useCallback(
    (image: HTMLImageElement) => {
      if (!image.isConnected) return; // 图片已不在文档中，停止重试
      if (image.complete && image.naturalWidth > 0) return; // 图片已加载成功，停止重试
      const { retryCount, retryDelay, count } = retryStatus.current;
      if (count >= retryCount) return; // 达到最大重试次数，停止重试

      const token = Date.now();
      // Full Jitter
      const delay = Math.random() * retryDelay * (count + 1);
      const canRun = (cb: NormalFunc) => {
        if (!image.isConnected) return;
        else if (token !== retryStatus.current.token) return;
        else if (image.complete && image.naturalWidth > 0) return;
        cb();
      };
      const retry = () => {
        retryStatus.current.count += 1;
        const newURL = new URL(sizedURL || image.src);
        newURL.searchParams.set("timestamp", Date.now().toString());
        image.src = newURL.toString();
        setError(false);
      };

      retryStatus.current.token = token;
      setTimeout(() => {
        canRun(() => {
          requestIdleCallback(() => canRun(retry), {
            timeout: 200
          });
        });
      }, delay);
    },
    [sizedURL]
  );

  // 图片加载错误处理
  const handleLoadError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      // 首次错误且为缓存URL时，尝试使用原始URL加载
      const canFallback =
        sizedURL && e.currentTarget.src !== sizedURL && retryStatus.current.count === 0;
      if (canFallback) {
        if (!cachedCover) requestCache.current?.();
        // 尝试使用原始尺寸图片
        e.currentTarget.src = sizedURL;
        requestIdleCallback(onCacheError, { timeout: 500 });
        return;
      }

      // 已经是原始URL或重试后仍然失败
      setError(true);
      if (e.currentTarget.src.startsWith(AppScheme)) {
        requestIdleCallback(onCacheError, { timeout: 500 });
      }
      if (retryOnError && retryCount > 0) {
        retry(e.currentTarget);
      }

      return onError?.(e);
    },
    [cachedCover, onCacheError, onError, retry, retryCount, retryOnError, sizedURL]
  );

  // src变化时重置错误状态和重试状态
  useEffect(() => {
    setError(false);
    retryStatus.current.count = 0;
    retryStatus.current.token = Date.now();
  }, [src]);

  return (
    <div
      onClick={onClick}
      className={cx(
        `
          bg-white/10 backdrop-blur-sm
          border-none overflow-hidden
        `,
        shadow && shadowMap[shadow][shadowColor],
        className
      )}>
      <img
        {...rest}
        className={cx(
          "w-full h-full object-cover aspect-square",
          error && "invisible",
          imageClassName
        )}
        src={pause ? undefined : cachedCover || cacheURL}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onError={handleLoadError}
      />
    </div>
  );
};
export default memo(NeteaseImage);

const shadowMap = {
  float: {
    dark: "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)]",
    light: "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.18)]"
  },
  base: {
    dark: "shadow-sm",
    light: "shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
  },
  none: {
    dark: "",
    light: ""
  }
} as const;
