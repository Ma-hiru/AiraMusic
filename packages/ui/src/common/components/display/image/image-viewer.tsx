import { cx } from "@emotion/css";
import { clamp } from "lodash-es";
import {
  ZoomIn,
  ZoomOut,
  Download,
  ImageOff,
  RotateCw,
  RotateCcw,
  ArrowLeftToLine,
  type LucideIcon,
  ArrowRightToLine,
  Image as ImageIcon
} from "lucide-react";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { Log } from "@/common/lib/log";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererWindow } from "@/common/lib/window";
import { RendererImagePreviewConstants } from "@/common/constants/image-preview";
import {
  getExtension,
  getURLFileName,
  resolveFilename,
  getImageExtension
} from "@/common/utils/file";
import AppToast from "@/common/components/display/toast";
import Marquee from "@/common/components/display/marquee";
import AppLoading from "@/common/components/fallback/app-loading";

const {
  MAX_SCALE,
  MIN_SCALE,
  WHEEL_STEP,
  EMPTY_IMAGE,
  ROTATE_STEP,
  MOVE_THRESHOLD,
  BUTTON_ZOOM_STEP,
  DOUBLE_TAP_DELAY,
  TOOLBAR_HIDE_DELAY,
  DOUBLE_TAP_DISTANCE
} = RendererImagePreviewConstants;

interface ImageViewerProps {
  index: number;
  images: { alt?: string; url?: string }[];
  onIndexChange: NormalFunc<[index: number]>;
  onToolBarChange?: NormalFunc<[visible: boolean]>;
}

const ImageViewer: FC<ImageViewerProps> = ({ onIndexChange, onToolBarChange, index, images }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const toolbarTimer = useRef<Nullable<number>>(null);
  const singleTapTimer = useRef<Nullable<number>>(null);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const startPointerPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const [status, setStatus] = useState<"idle" | "error" | "loaded" | "loading">("idle");
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
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
      transform: `translate(${translate.x}px, ${translate.y}px) rotate(${rotation}deg) scale(${scale})`,
      transition: dragging ? "none" : "transform 180ms ease",
      cursor: dragging ? "grabbing" : scale > 1 ? "grab" : "zoom-in"
    }),
    [dragging, rotation, scale, translate.x, translate.y]
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
    setRotation(0);
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
    (nextScale = scale, nextRotation = rotation) => {
      const viewer = viewerRef.current;
      const image = imageRef.current;
      if (!viewer || !image) return { maxX: 0, maxY: 0 };

      const { width: baseW, height: baseH } = calcContainedImageSize(image);
      // 旋转 90°/270° 时图片包围盒的宽高互换
      const rotated = nextRotation % 180 !== 0;
      const scaledW = (rotated ? baseH : baseW) * nextScale;
      const scaledH = (rotated ? baseW : baseH) * nextScale;

      return {
        maxX: Math.max(0, (scaledW - viewer.clientWidth) / 2),
        maxY: Math.max(0, (scaledH - viewer.clientHeight) / 2)
      };
    },
    [calcContainedImageSize, rotation, scale]
  );

  const clampTranslate = useCallback(
    (value: { x: number; y: number }, nextScale = scale, nextRotation = rotation) => {
      const { maxX, maxY } = calcImageTranslateBounds(nextScale, nextRotation);
      return {
        x: clamp(value.x, -maxX, maxX),
        y: clamp(value.y, -maxY, maxY)
      };
    },
    [calcImageTranslateBounds, rotation, scale]
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

  const rotate = useCallback(
    (delta: number) => {
      if (status !== "loaded") return;
      const nextRotation = (((rotation + delta) % 360) + 360) % 360;
      setRotation(nextRotation);
      setTranslate((prev) => clampTranslate(prev, scale, nextRotation));
      showToolbar(true);
    },
    [clampTranslate, rotation, scale, showToolbar, status]
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
      if (result.canceled) {
        AppToast.show({ type: "info", text: "已取消" });
        return;
      } else if (!result.ok) {
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
        case "r":
        case "R":
          if (event.ctrlKey || event.metaKey) break;
          event.preventDefault();
          rotate(ROTATE_STEP);
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
  }, [lastImage, nextImage, resetTransform, rotate, saveImage, showToolbar, zoomFromCenter]);

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
          className={cx(
            `
              pointer-events-none absolute -inset-12 h-[calc(100%+96px)] w-[calc(100%+96px)]
              scale-105 object-cover opacity-0 blur-3xl transition-opacity duration-500
            `,
            status === "loaded" && toolBarVisible ? "opacity-50" : "opacity-35"
          )}
          src={imageSrc}
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
            flex min-w-0 max-w-[60%] items-center gap-2 rounded-md
            border border-white/10 bg-black/35 px-4 py-1.5 text-[12px] font-semibold
            text-white/85 shadow-[0_8px_32px_rgba(0,0,0,0.25)]
            backdrop-saturate-120 backdrop-blur-md
          ">
          <Marquee
            text={current.alt || current.url || "等待图片"}
            options={{
              speed: 10,
              pauseOnHover: true,
              pingPong: true,
              gapDuration: 2000
            }}
          />
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
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}>
        {imageSrc && (
          <img
            ref={imageRef}
            className={cx(
              `
                h-full w-full select-none object-contain opacity-0
                drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)]
                transition-opacity duration-300 will-change-transform
              `,
              status === "loaded" && "opacity-100"
            )}
            style={imageStyle}
            src={imageSrc}
            alt={current.alt}
            draggable={false}
            onError={() => setStatus("error")}
            onLoad={() => setStatus("loaded")}
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
            className="absolute inset-0 z-10 bg-black/20 text-white"
            tips="图片加载中"
            loading
          />
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/75">
            <ImageOff className="size-12 opacity-80" />
            <p className="text-[13px] font-semibold">图片加载失败</p>
            <button
              className="
                rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-[12px]
                font-semibold text-white/90 backdrop-blur-md transition-all duration-200
                ease-in-out hover:bg-white/15 active:scale-95
              "
              type="button"
              onClick={retryLoad}>
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
            rounded-lg border border-white/10 bg-black/35 px-2 py-1.5
            shadow-[0_20px_60px_rgba(0,0,0,0.4)]
            backdrop-saturate-120 backdrop-blur-md
            transition-all duration-300 ease-in-out
          `,
          toolBarVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0"
        )}>
        <ToolbarButton
          label="上一张"
          icon={ArrowLeftToLine}
          disabled={images.length <= 1}
          onClick={lastImage}
        />
        <ToolbarButton
          label="缩小"
          icon={ZoomOut}
          disabled={status !== "loaded" || scale <= MIN_SCALE}
          onClick={() => zoomFromCenter(-BUTTON_ZOOM_STEP)}
        />
        <button
          className={cx(
            `
              flex h-9 min-w-18 items-center justify-center gap-2 rounded-md px-2
              text-[12px] font-semibold text-white/80 transition-all duration-200
              ease-in-out hover:bg-white/15 hover:text-white active:scale-95
              focus-visible:ring-2 focus-visible:ring-white/45
            `,
            status !== "loaded" && "pointer-events-none opacity-35"
          )}
          title="重置视图"
          type="button"
          aria-label="重置视图"
          disabled={status !== "loaded"}
          onClick={() => {
            resetTransform();
            showToolbar(true);
          }}>
          <RotateCcw className="size-4" />
          <span>{Math.round(scale * 100)}%</span>
        </button>
        <ToolbarButton
          label="放大"
          icon={ZoomIn}
          disabled={status !== "loaded" || scale >= MAX_SCALE}
          onClick={() => zoomFromCenter(BUTTON_ZOOM_STEP)}
        />
        <ToolbarButton
          label="向右旋转"
          icon={RotateCw}
          disabled={status !== "loaded"}
          onClick={() => rotate(ROTATE_STEP)}
        />
        <ToolbarButton
          label="保存图片"
          icon={Download}
          disabled={status !== "loaded" || !hasImages}
          onClick={() => void saveImage()}
        />
        <ToolbarButton
          label="下一张"
          icon={ArrowRightToLine}
          disabled={images.length <= 1}
          onClick={nextImage}
        />
      </div>
    </div>
  );
};

const ToolbarButton = ({
  onClick,
  label,
  disabled,
  icon: Icon
}: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick?: NormalFunc;
}) => {
  return (
    <button
      className={cx(
        `
          flex size-9 items-center justify-center rounded-md
          text-white/85 outline-none transition-all duration-200 ease-in-out
          hover:bg-white/15 hover:text-white active:scale-[0.92]
          focus-visible:ring-2 focus-visible:ring-white/45
        `,
        disabled && "pointer-events-none opacity-35"
      )}
      title={label}
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}>
      <Icon className="size-4.5" />
    </button>
  );
};

const createDownloadName = (
  image: { alt?: string; url?: string },
  contentType: Nullable<string>
) => {
  const urlFileName = getURLFileName(image.url);
  const ext = getImageExtension(contentType) || getExtension(urlFileName);
  return resolveFilename(image.alt || urlFileName || "image", ext || "jpg");
};

export default memo(ImageViewer);
