import {
  FC,
  ImgHTMLAttributes,
  memo,
  MouseEvent as ReactMouseEvent,
  startTransition,
  SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import {
  NeteaseLocalImage,
  NeteaseNetworkImage
} from "@mahiru/ui/public/source/netease/models/NeteaseImage";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

type ShadowLevel = "none" | "base" | "float";

type ShadowColor = "light" | "dark";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  imageClassName?: string;
  retryOnError?: boolean;
  retryDelay?: number;
  retryCount?: number;
  shadow?: ShadowLevel;
  shadowColor?: ShadowColor;
  pause?: boolean;
  preview?: boolean;
  image: Optional<NeteaseNetworkImage | NeteaseLocalImage>;
  cache: boolean;
  cacheLazy?: boolean;
  cacheLazyProps?: {
    root?: Element | null;
    rootMargin?: string;
    threshold?: number;
  };
};

const NeteaseImage: FC<ImageProps> = ({
  image,
  cache,
  alt,
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
  preview,
  cacheLazy = true,
  cacheLazyProps,
  ...rest
}) => {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<Nullable<NeteaseNetworkImage | NeteaseLocalImage>>(null);
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
    const { retryCount, retryDelay, count } = retryStatus.current;
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
      if (source?.isLocal && image) {
        return setSource(image.toNetworkImage());
      } else if (source?.isNetwork && retryOnError) {
        return retry(e.currentTarget);
      }
      return onError?.(e);
    },
    [image, onError, retry, retryOnError, source]
  );

  const wrapClick = useCallback(
    async (e: ReactMouseEvent<HTMLImageElement>) => {
      if (preview && image) {
        const imageWindow = ElectronServices.Window.from("image");
        const sendImage = image.toNetworkImage().setSize(NeteaseImageSize.raw);
        await imageWindow.openAwait();
        imageWindow.send("imageCheckerBus", {
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
        rootMargin: "150px", // 提前加载（关键）
        threshold: 0,
        ...cacheLazyProps
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [cacheLazyProps]);

  useEffect(() => {
    if (pause || !image?.src || (cacheLazy && !visible)) return;
    NeteaseServices.Image.local(image, cache).then((local) => {
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
  }, [image]);

  return (
    <div
      ref={containerRef}
      onClick={wrapClick}
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
        src={source?.src}
        alt={alt ?? source?.alt}
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
