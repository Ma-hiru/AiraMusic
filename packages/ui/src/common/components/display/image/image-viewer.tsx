import { cx } from "@emotion/css";
import { clamp } from "lodash-es";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Download,
  Image as ImageIcon,
  ImageOff,
  type LucideIcon,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  type CSSProperties,
  type FC,
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent as ReactWheelEvent
} from "react";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import AppToast from "@/common/components/display/toast";
import AppLoading from "@/common/components/fallback/app-loading";

export type ImageViewerEntry = {
  url?: string;
  alt?: string;
};

interface ImageViewerProps {
  images: ImageViewerEntry[];
  index: number;
  onIndexChange: NormalFunc<[index: number]>;
  onToolBarChange?: NormalFunc<[visible: boolean]>;
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick?: NormalFunc;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const WHEEL_STEP = 0.12;
const BUTTON_ZOOM_STEP = 0.35;
const DOUBLE_TAP_DELAY = 300;
const DOUBLE_TAP_DISTANCE = 30;
const MOVE_THRESHOLD = 10;
const TOOLBAR_HIDE_DELAY = 3000;
const EMPTY_IMAGE: ImageViewerEntry = {};
const UNSAFE_FILE_NAME = /[<>:"/\\|?*]/g;

const ToolbarButton: FC<ToolbarButtonProps> = ({ icon: Icon, label, disabled, onClick }) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        `
          flex size-9 items-center justify-center rounded-md
          text-white/85 outline-none transition-all duration-200 ease-in-out
          hover:bg-white/15 hover:text-white active:scale-[0.92]
          focus-visible:ring-2 focus-visible:ring-white/45
        `,
        disabled && "pointer-events-none opacity-35"
      )}>
      <Icon className="size-4.5" />
    </button>
  );
};

const MemoToolbarButton = memo(ToolbarButton);

const ImageViewer: FC<ImageViewerProps> = ({ images, index, onIndexChange, onToolBarChange }) => {
  useThemeInjectFromBus();

  const viewerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const toolbarTimer = useRef<Nullable<number>>(null);
  const singleTapTimer = useRef<Nullable<number>>(null);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const startPointerPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const [status, setStatus] = useState<"idle" | "loading" | "error" | "loaded">("idle");
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [toolBarVisible, setToolBarVisible] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const current = images[index] ?? images[0] ?? EMPTY_IMAGE;
  const hasImages = images.length > 0;
  const imageSrc = useMemo(() => {
    if (!current.url) return undefined;
    if (!reloadToken) return current.url;
    try {
      const url = new URL(current.url, window.location.href);
      url.searchParams.set("timestamp", String(reloadToken));
      return url.toString();
    } catch {
      return current.url;
    }
  }, [current.url, reloadToken]);

  const imageStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
      transition: dragging ? "none" : "transform 180ms ease",
      cursor: dragging ? "grabbing" : scale > 1 ? "grab" : "zoom-in"
    }),
    [dragging, scale, translate.x, translate.y]
  );

  const showToolbar = useCallback(
    (visible = true) => {
      setToolBarVisible(visible);
      onToolBarChange?.(visible);
      if (toolbarTimer.current) {
        window.clearTimeout(toolbarTimer.current);
        toolbarTimer.current = null;
      }
      if (visible) {
        toolbarTimer.current = window.setTimeout(() => {
          setToolBarVisible(false);
          onToolBarChange?.(false);
        }, TOOLBAR_HIDE_DELAY);
      }
    },
    [onToolBarChange]
  );

  const resetTransform = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const calcContainedImageSize = useCallback((image: HTMLImageElement) => {
    const naturalW = image.naturalWidth;
    const naturalH = image.naturalHeight;
    if (!naturalW || !naturalH) return { width: 0, height: 0 };

    const boxW = image.offsetWidth;
    const boxH = image.offsetHeight;
    const imageRatio = naturalW / naturalH;
    const boxRatio = boxW / boxH;

    if (imageRatio > boxRatio) {
      return { width: boxW, height: boxW / imageRatio };
    }
    return { width: boxH * imageRatio, height: boxH };
  }, []);

  const calcImageTranslateBounds = useCallback(
    (nextScale = scale) => {
      const viewer = viewerRef.current;
      const image = imageRef.current;
      if (!viewer || !image) return { maxX: 0, maxY: 0 };

      const { width: baseW, height: baseH } = calcContainedImageSize(image);
      const scaledW = baseW * nextScale;
      const scaledH = baseH * nextScale;

      return {
        maxX: Math.max(0, (scaledW - viewer.clientWidth) / 2),
        maxY: Math.max(0, (scaledH - viewer.clientHeight) / 2)
      };
    },
    [calcContainedImageSize, scale]
  );

  const clampTranslate = useCallback(
    (value: { x: number; y: number }, nextScale = scale) => {
      const { maxX, maxY } = calcImageTranslateBounds(nextScale);
      return {
        x: clamp(value.x, -maxX, maxX),
        y: clamp(value.y, -maxY, maxY)
      };
    },
    [calcImageTranslateBounds, scale]
  );

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const viewerRect = viewer.getBoundingClientRect();
      const mouseX = clientX - viewerRect.left - viewerRect.width / 2;
      const mouseY = clientY - viewerRect.top - viewerRect.height / 2;
      const safeNextScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

      setTranslate((prev) =>
        clampTranslate(
          {
            x: mouseX - ((mouseX - prev.x) * safeNextScale) / scale,
            y: mouseY - ((mouseY - prev.y) * safeNextScale) / scale
          },
          safeNextScale
        )
      );
      setScale(safeNextScale);
    },
    [clampTranslate, scale]
  );

  const zoomFromCenter = useCallback(
    (delta: number) => {
      const viewer = viewerRef.current;
      if (!viewer || status !== "loaded") return;
      const rect = viewer.getBoundingClientRect();
      zoomAtPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        clamp(scale + delta, MIN_SCALE, MAX_SCALE)
      );
      showToolbar(true);
    },
    [scale, showToolbar, status, zoomAtPoint]
  );

  const lastImage = useCallback(() => {
    if (images.length <= 1) return;
    onIndexChange(index - 1 >= 0 ? index - 1 : images.length - 1);
    showToolbar(true);
  }, [images.length, index, onIndexChange, showToolbar]);

  const nextImage = useCallback(() => {
    if (images.length <= 1) return;
    onIndexChange((index + 1) % images.length);
    showToolbar(true);
  }, [images.length, index, onIndexChange, showToolbar]);

  const retryLoad = useCallback(() => {
    if (!current.url) return;
    resetTransform();
    setStatus("loading");
    setReloadToken(Date.now());
    showToolbar(true);
  }, [current.url, resetTransform, showToolbar]);

  const saveImage = useCallback(async () => {
    if (status !== "loaded" || !current.url) return;
    try {
      const response = await fetch(current.url);
      if (!response.ok) Log.throw({ message: "网络错误" });

      const contentType = response.headers.get("content-type");
      const buffer = await response.arrayBuffer();
      const name = createDownloadName(current, contentType);
      const result = await RendererIPC.NormalChannel.send("invoke_fs_save", { buffer, name });

      if (!result.ok) {
        result.error && Log.error(result.error);
        AppToast.show({ type: "error", text: "图片保存失败" });
        return;
      }
      AppToast.show({ type: "success", text: "图片已保存" });
    } catch (err) {
      Log.error(err);
      AppToast.show({ type: "error", text: "图片保存失败" });
    }
  }, [current, status]);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (status !== "loaded") return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      zoomAtPoint(event.clientX, event.clientY, clamp(scale + delta, MIN_SCALE, MAX_SCALE));
      showToolbar(true);
    },
    [scale, showToolbar, status, zoomAtPoint]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (status !== "loaded" || event.button !== 0) return;
      setDragging(true);
      moved.current = false;
      lastPointerPos.current = { x: event.clientX, y: event.clientY };
      startPointerPos.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [status]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;

      const dx = event.clientX - lastPointerPos.current.x;
      const dy = event.clientY - lastPointerPos.current.y;
      const totalDx = event.clientX - startPointerPos.current.x;
      const totalDy = event.clientY - startPointerPos.current.y;

      if (Math.abs(totalDx) + Math.abs(totalDy) > MOVE_THRESHOLD) {
        moved.current = true;
      }

      setTranslate((prev) => clampTranslate({ x: prev.x + dx, y: prev.y + dy }, scale));
      lastPointerPos.current = { x: event.clientX, y: event.clientY };
    },
    [clampTranslate, dragging, scale]
  );

  const toggleZoomAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const isReset =
        Math.abs(scale - 1) < 0.001 &&
        Math.abs(translate.x) < 0.001 &&
        Math.abs(translate.y) < 0.001;
      if (isReset) {
        zoomAtPoint(clientX, clientY, 2);
      } else {
        resetTransform();
      }
      showToolbar(true);
    },
    [resetTransform, scale, showToolbar, translate.x, translate.y, zoomAtPoint]
  );

  const handleTap = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const now = performance.now();
      const tapDist = Math.hypot(
        event.clientX - lastTapPos.current.x,
        event.clientY - lastTapPos.current.y
      );

      if (now - lastTapTime.current < DOUBLE_TAP_DELAY && tapDist < DOUBLE_TAP_DISTANCE) {
        if (singleTapTimer.current) {
          window.clearTimeout(singleTapTimer.current);
          singleTapTimer.current = null;
        }
        lastTapTime.current = 0;
        lastTapPos.current = { x: 0, y: 0 };
        toggleZoomAtPoint(event.clientX, event.clientY);
        return;
      }

      lastTapTime.current = now;
      lastTapPos.current = { x: event.clientX, y: event.clientY };
      if (singleTapTimer.current) window.clearTimeout(singleTapTimer.current);
      singleTapTimer.current = window.setTimeout(() => {
        showToolbar(!toolBarVisible);
      }, DOUBLE_TAP_DELAY);
    },
    [showToolbar, toggleZoomAtPoint, toolBarVisible]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (moved.current) {
        moved.current = false;
        return;
      }
      handleTap(event);
    },
    [dragging, handleTap]
  );

  useEffect(() => {
    if (!images.length) return;
    if (index > images.length - 1) onIndexChange(images.length - 1);
  }, [images.length, index, onIndexChange]);

  useEffect(() => {
    document.title = current.url ? current.alt || current.url : "Image Viewer";
    resetTransform();
    setReloadToken(0);
    setStatus(current.url ? "loading" : "idle");
  }, [current.alt, current.url, resetTransform]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setStatus("loaded");
    }
  }, [imageSrc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          lastImage();
          break;
        case "ArrowRight":
          event.preventDefault();
          nextImage();
          break;
        case "Escape":
          event.preventDefault();
          RendererWindow.current.close();
          break;
        case "0":
          event.preventDefault();
          resetTransform();
          showToolbar(true);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomFromCenter(BUTTON_ZOOM_STEP);
          break;
        case "-":
          event.preventDefault();
          zoomFromCenter(-BUTTON_ZOOM_STEP);
          break;
        case "s":
        case "S":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            void saveImage();
          }
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastImage, nextImage, resetTransform, saveImage, showToolbar, zoomFromCenter]);

  useEffect(() => {
    return () => {
      toolbarTimer.current && window.clearTimeout(toolbarTimer.current);
      singleTapTimer.current && window.clearTimeout(singleTapTimer.current);
    };
  }, []);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#050505] text-white"
      onMouseMove={() => showToolbar(true)}>
      {/*背景*/}
      {current.url && (
        <img
          src={imageSrc}
          className={cx(
            `
              pointer-events-none absolute -inset-12 h-[calc(100%+96px)] w-[calc(100%+96px)]
              scale-105 object-cover opacity-0 blur-3xl transition-opacity duration-500
            `,
            status === "loaded" && toolBarVisible ? "opacity-50" : "opacity-35"
          )}
          alt={current.alt}
        />
      )}

      {/*标题栏*/}
      <div
        className={cx(
          `
            pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-14
            items-center justify-center px-24 transition-all duration-300 ease-in-out
          `,
          toolBarVisible ? "translate-y-0 opacity-100" : "-translate-y-5 opacity-0"
        )}>
        <div
          className="
            flex min-w-0 max-w-[min(76vw,780px)] items-center gap-2 rounded-md
            border border-white/10 bg-black/35 px-4 py-1.5 text-[12px] font-semibold
            text-white/85 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md
          ">
          <span className="truncate">{current.alt || current.url || "等待图片"}</span>
          {images.length > 1 && (
            <span className="shrink-0 text-white/55">{`${index + 1}/${images.length}`}</span>
          )}
        </div>
      </div>

      {/*内容（图片）区域*/}
      <div
        ref={viewerRef}
        className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}>
        {imageSrc && (
          <img
            ref={imageRef}
            src={imageSrc}
            alt={current.alt}
            draggable={false}
            style={imageStyle}
            className={cx(
              `
                h-full w-full select-none object-contain opacity-0
                drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)]
                transition-opacity duration-300 will-change-transform
              `,
              status === "loaded" && "opacity-100"
            )}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
          />
        )}

        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/55">
            <ImageIcon className="size-12 opacity-75" />
            <p className="text-[13px] font-semibold">等待图片</p>
          </div>
        )}

        {status === "loading" && (
          <AppLoading
            loading
            tips="图片加载中"
            className="absolute inset-0 z-10 bg-black/20 text-white"
          />
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/75">
            <ImageOff className="size-12 opacity-80" />
            <p className="text-[13px] font-semibold">图片加载失败</p>
            <button
              type="button"
              onClick={retryLoad}
              className="
                rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[12px]
                font-semibold text-white/90 backdrop-blur-md transition-all duration-200
                ease-in-out hover:bg-white/15 active:scale-95
              ">
              重新加载
            </button>
          </div>
        )}
      </div>

      {/*工具栏*/}
      <div
        className={cx(
          `
            absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1
            rounded-lg border border-white/10 bg-black/45 px-2 py-1.5
            shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl
            transition-all duration-300 ease-in-out
          `,
          toolBarVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        )}>
        <MemoToolbarButton
          icon={ArrowLeftToLine}
          label="上一张"
          disabled={images.length <= 1}
          onClick={lastImage}
        />
        <MemoToolbarButton
          icon={ZoomOut}
          label="缩小"
          disabled={status !== "loaded" || scale <= MIN_SCALE}
          onClick={() => zoomFromCenter(-BUTTON_ZOOM_STEP)}
        />
        <button
          type="button"
          aria-label="重置缩放"
          title="重置缩放"
          disabled={status !== "loaded"}
          onClick={() => {
            resetTransform();
            showToolbar(true);
          }}
          className={cx(
            `
              flex h-9 min-w-18 items-center justify-center gap-2 rounded-md px-2
              text-[12px] font-semibold text-white/80 transition-all duration-200
              ease-in-out hover:bg-white/15 hover:text-white active:scale-95
              focus-visible:ring-2 focus-visible:ring-white/45
            `,
            status !== "loaded" && "pointer-events-none opacity-35"
          )}>
          <RotateCcw className="size-4" />
          <span>{Math.round(scale * 100)}%</span>
        </button>
        <MemoToolbarButton
          icon={ZoomIn}
          label="放大"
          disabled={status !== "loaded" || scale >= MAX_SCALE}
          onClick={() => zoomFromCenter(BUTTON_ZOOM_STEP)}
        />
        <MemoToolbarButton
          icon={Download}
          label="保存图片"
          disabled={status !== "loaded" || !hasImages}
          onClick={() => void saveImage()}
        />
        <MemoToolbarButton
          icon={ArrowRightToLine}
          label="下一张"
          disabled={images.length <= 1}
          onClick={nextImage}
        />
      </div>
    </div>
  );
};

function createDownloadName(image: ImageViewerEntry, contentType: Nullable<string>) {
  const fallbackName = getURLFileName(image.url) || "image";
  const baseName =
    stripControlChars(image.alt || fallbackName)
      .replace(UNSAFE_FILE_NAME, "_")
      .trim() || "image";
  const ext = getImageExtension(contentType) || getExtension(fallbackName) || "jpg";
  return ensureExtension(baseName.slice(0, 120), ext);
}

function getImageExtension(contentType: Nullable<string>) {
  const value = contentType?.split(";")[0]?.trim().toLowerCase();
  if (!value?.startsWith("image/")) return "";
  const ext = value.slice("image/".length);
  if (ext === "jpeg") return "jpg";
  if (ext === "svg+xml") return "svg";
  return ext || "";
}

function getURLFileName(url: Optional<string>) {
  if (!url) return "";
  try {
    const path = new URL(url, window.location.href).pathname;
    return decodeURIComponent(path.split("/").filter(Boolean).at(-1) || "");
  } catch {
    return url.split("/").filter(Boolean).at(-1) || "";
  }
}

function getExtension(fileName: string) {
  const ext = fileName.split(".").at(-1);
  if (!ext || ext === fileName) return "";
  return ext.replace(UNSAFE_FILE_NAME, "").toLowerCase();
}

function stripControlChars(value: string) {
  return [...value].filter((char) => char.charCodeAt(0) >= 32).join("");
}

function ensureExtension(fileName: string, ext: string) {
  const normalizedExt = ext.replace(/^\./, "");
  if (!normalizedExt) return fileName;
  if (fileName.toLowerCase().endsWith(`.${normalizedExt.toLowerCase()}`)) return fileName;
  return `${fileName}.${normalizedExt}`;
}

export default memo(ImageViewer);
