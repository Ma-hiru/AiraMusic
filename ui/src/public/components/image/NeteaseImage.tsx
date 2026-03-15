import {
  FC,
  ImgHTMLAttributes,
  memo,
  MouseEvent as ReactMouseEvent,
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
} from "@mahiru/ui/public/models/netease/NeteaseImage";
import NeteaseSource from "@mahiru/ui/public/entry/source";
import AppRenderer from "@mahiru/ui/public/entry/renderer";
import { isMainWindow } from "@mahiru/ui/public/utils/dev";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

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
  ...rest
}) => {
  const [error, setError] = useState(false);
  const [source, setSource] = useState<Nullable<NeteaseNetworkImage | NeteaseLocalImage>>(null);
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
    (e: ReactMouseEvent<HTMLImageElement>) => {
      if (preview && image) {
        AppRenderer.invoke.hasOpenInternalWindow("image").then((opened) => {
          const sendImage = image.toNetworkImage().setSize(NeteaseImageSize.raw);
          if (!opened) {
            if (isMainWindow()) {
              AppRenderer.event.openInternalWindow("image");
              AppRenderer.event.focusInternalWindow("image");
            } else {
              AppRenderer.sendMessage("playerControl", "main", "openImageWindow");
            }
            AppRenderer.addMessageHandler(
              "otherWindowLoaded",
              "image",
              () => {
                AppRenderer.sendMessage("checkImage", "image", {
                  url: sendImage.src,
                  alt: alt ?? sendImage.alt
                });
              },
              { id: "imageCheckHandler", once: true }
            );
          } else {
            if (isMainWindow()) {
              AppRenderer.event.focusInternalWindow("image");
            } else {
              AppRenderer.sendMessage("playerControl", "main", "openImageWindow");
            }
            AppRenderer.sendMessage("checkImage", "image", {
              url: sendImage.src,
              alt: alt ?? sendImage.alt
            });
          }
        });
      }
      return onClick?.(e);
    },
    [alt, image, onClick, preview]
  );

  useEffect(() => {
    if (pause || !image?.src) return;
    NeteaseSource.Image.try(image, cache).then((local) => {
      if (local) setSource(local);
      else setSource(image);
    });
  }, [cache, image, pause]);

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
