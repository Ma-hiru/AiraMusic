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
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { cx } from "@emotion/css";
import { AppScheme } from "@mahiru/ui/constants/scheme";

type ShadowLevel = "none" | "base" | "float";

type ShadowColor = "light" | "dark";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  id?: string | number;
  update?: boolean;
  timeLimit?: number;
  method?: string;
  size?: ImageSize;
  imageClassName?: string;
  onCacheHit?: NormalFunc<[file: string, id: string]>;
  retryOnError?: boolean;
  retryDelay?: number;
  retryCount?: number;
  retryURL?: string;
  onCacheError?: NormalFunc;
  shadow?: ShadowLevel;
  shadowColor?: ShadowColor;
  fastLocation?: boolean;
};

const NeteaseImage: FC<ImageProps> = ({
  id,
  update = false,
  timeLimit,
  method = "GET",
  src,
  onCacheHit,
  alt,
  size = ImageSize.raw,
  onError,
  onCacheError,
  className,
  loading = "lazy",
  decoding = "async",
  imageClassName,
  retryCount = 2,
  retryDelay = 500,
  retryOnError = true,
  retryURL,
  shadow = "base",
  shadowColor = "light",
  onClick,
  fastLocation,
  ...rest
}) => {
  const [error, setError] = useState(false);
  const sizedURL = useMemo(() => Filter.NeteaseImageSize(src, size), [size, src]);
  const cachedCover = useFileCache(sizedURL, {
    onCacheHit,
    id,
    update: update,
    timeLimit,
    method,
    fastLocation
  });
  const retryStatus = useRef({
    token: 0,
    count: 0,
    retryCount,
    retryDelay
  });

  retryStatus.current.retryCount = retryCount;
  retryStatus.current.retryDelay = retryDelay;

  const retry = useCallback(
    (image: HTMLImageElement) => {
      if (!image.isConnected) return;
      if (image.complete && image.naturalWidth > 0) return;

      const { retryCount, retryDelay, count } = retryStatus.current;
      if (count >= retryCount) return;

      const token = Date.now();
      retryStatus.current.token = token;
      const check = () => {
        let ok = true;
        if (!image.isConnected) ok = false;
        else if (token !== retryStatus.current.token) ok = false;
        else if (image.complete && image.naturalWidth > 0) ok = false;
        return ok;
      };

      setTimeout(
        () => {
          if (!check()) return;
          requestIdleCallback(() => {
            if (!check()) return;
            retryStatus.current.count += 1;
            const newURL = new URL(retryURL ? retryURL : image.src);
            newURL.searchParams.set("timestamp", Date.now().toString());
            image.src = newURL.toString();
            setError(false);
          });
        },
        retryDelay * (count + 1)
      );
    },
    [retryURL]
  );
  const handleLoadError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const canFallback = e.currentTarget.src !== sizedURL && !!sizedURL;
      if (canFallback) {
        e.currentTarget.src = sizedURL;
        requestIdleCallback(() => onCacheError?.(), { timeout: 500 });
        return;
      }

      setError(true);
      if (!canFallback && e.currentTarget.src.startsWith(AppScheme)) {
        requestIdleCallback(() => onCacheError?.(), { timeout: 500 });
      }
      if (retryOnError && retryCount > 0) {
        retry(e.currentTarget);
      }

      return onError?.(e);
    },
    [onCacheError, onError, retry, retryCount, retryOnError, sizedURL]
  );
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
        src={cachedCover}
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
