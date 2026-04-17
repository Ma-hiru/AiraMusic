import { FC, MouseEvent as ReactMouseEvent, useCallback, useRef } from "react";
import { cx } from "@emotion/css";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

interface WindowResizeProps {
  disable: boolean;
  showArea: boolean;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  minWidth?: number;
  minHeight?: number;
}

export const WindowResize: FC<WindowResizeProps> = ({
  disable,
  showArea,
  onResizeEnd,
  onResizeStart,
  minWidth = 260,
  minHeight = 120
}) => {
  const resizeSession = useRef<Nullable<ResizeSession>>(null);
  const resizeRaf = useRef<Nullable<number>>(null);
  const pendingBounds = useRef<WindowBoundsPatch>({});
  const currentWindow = useListenableHook(ElectronServices.Window.current);

  // 批量调度窗口尺寸变更
  const dispatchBounds = useCallback(
    (patch: WindowBoundsPatch) => {
      // 合并当前 patch 到 pendingBounds：
      // 如果在一帧内多次 mousemove，会把最新的 width/height/x/y 合并，保证最终提交的是最近一次的值（覆盖优先）
      pendingBounds.current = { ...pendingBounds.current, ...patch };
      if (resizeRaf.current !== null) return;
      // 如果已经安排过一次 requestAnimationFrame 去提交更新，就不用再安排新的了
      resizeRaf.current = requestAnimationFrame(() => {
        resizeRaf.current = null;
        if (!pendingBounds.current || Object.keys(pendingBounds.current).length === 0) return;
        currentWindow.resize(pendingBounds.current);
        pendingBounds.current = {};
      });
    },
    [currentWindow]
  );

  // 处理鼠标移动以调整窗口大小
  const handleResizeMove = useCallback(
    (event: MouseEvent) => {
      const session = resizeSession.current;
      if (!session) return;
      event.preventDefault();
      // 鼠标相对于按下时的水平移动（屏幕坐标）。
      // 正值：鼠标向右移动；负值：向左移动。
      const mouseDeltaX = event.screenX - session.mouseStartScreenX;
      // 正值向下移动，负值向上
      const mouseDeltaY = event.screenY - session.mouseStartScreenY;
      const includes = (flag: "left" | "right" | "top" | "bottom") =>
        session.clickDirection.includes(flag);

      let nextWidth = session.windowStartWidth;
      let nextHeight = session.windowStartHeight;
      let nextX = session.windowStartX;
      let nextY = session.windowStartY;

      // 拖动右侧时，鼠标向右（deltaX > 0）应增大窗口宽度
      if (includes("right")) {
        nextWidth = Math.max(minWidth, session.windowStartWidth + mouseDeltaX);
      }
      // 拖动左边或左下/左上 要同时改宽和 x
      if (includes("left")) {
        // 拖动左边时，鼠标向右是把左边往右推，导致窗口宽度减少；鼠标向左是把左边向左拉，宽度增加。
        nextWidth = Math.max(minWidth, session.windowStartWidth - mouseDeltaX);
        const diff = session.windowStartWidth - nextWidth;
        nextX = session.windowStartX + diff;
      }
      if (includes("bottom")) {
        nextHeight = Math.max(minHeight, session.windowStartHeight + mouseDeltaY);
      }
      if (includes("top")) {
        nextHeight = Math.max(minHeight, session.windowStartHeight - mouseDeltaY);
        const diff = session.windowStartHeight - nextHeight;
        nextY = session.windowStartY + diff;
      }

      const patch: WindowBoundsPatch = {
        width: Math.round(nextWidth),
        height: Math.round(nextHeight)
      };
      if (includes("left")) patch.x = Math.round(nextX);
      if (includes("top")) patch.y = Math.round(nextY);

      dispatchBounds(patch);
    },
    [dispatchBounds, minHeight, minWidth]
  );

  const handleResizeEnd = useCallback(() => {
    if (!resizeSession.current) return;
    resizeSession.current = null;
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    pendingBounds.current = {};
    if (resizeRaf.current !== null) {
      cancelAnimationFrame(resizeRaf.current);
      resizeRaf.current = null;
    }
    onResizeEnd?.();
  }, [handleResizeMove, onResizeEnd]);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (event: ReactMouseEvent) => {
      if (disable) return;
      // 防止浏览器默认行为
      event.preventDefault();
      // 阻止事件向上冒泡，避免触发其他鼠标处理逻辑
      event.stopPropagation();
      onResizeStart?.();
      resizeSession.current = {
        clickDirection: direction,
        mouseStartScreenX: event.screenX,
        mouseStartScreenY: event.screenY,
        windowStartWidth: window.innerWidth,
        windowStartHeight: window.innerHeight,
        windowStartX: window.screenX,
        windowStartY: window.screenY
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = ResizeCursor[direction];
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    },
    [disable, handleResizeEnd, handleResizeMove, onResizeStart]
  );

  return (
    !disable && (
      <div className="pointer-events-none absolute inset-0 z-50">
        {ResizeAreas.map(({ direction, style }) => (
          <div
            key={direction}
            className={cx(
              "absolute pointer-events-auto",
              showArea ? "bg-white/10" : "bg-transparent"
            )}
            style={style}
            onMouseDown={handleResizeStart(direction)}
          />
        ))}
      </div>
    )
  );
};

type WindowBoundsPatch = Partial<{ x: number; y: number; width: number; height: number }>;

type ResizeDirection =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type ResizeSession = {
  // 哪一条边/哪一个角被按下
  clickDirection: ResizeDirection;
  // 鼠标在屏幕坐标系的坐标
  mouseStartScreenX: number;
  mouseStartScreenY: number;
  // 按下时视口宽高
  windowStartWidth: number;
  windowStartHeight: number;
  // 按下时窗口左上角在屏幕上的坐标
  windowStartX: number;
  windowStartY: number;
};

const ResizeCursor = {
  top: "ns-resize",
  bottom: "ns-resize",
  left: "ew-resize",
  right: "ew-resize",
  "top-left": "nwse-resize",
  "top-right": "nwse-resize",
  "bottom-left": "nwse-resize",
  "bottom-right": "nwse-resize"
} as const;

const ResizeAreas = [
  {
    direction: "top",
    style: { top: 0, left: 16, right: 16, height: 6, cursor: ResizeCursor["top"] }
  },
  {
    direction: "bottom",
    style: { bottom: 0, left: 16, right: 16, height: 6, cursor: ResizeCursor["bottom"] }
  },
  {
    direction: "left",
    style: { top: 16, bottom: 16, left: 0, width: 6, cursor: ResizeCursor["left"] }
  },
  {
    direction: "right",
    style: { top: 16, bottom: 16, right: 0, width: 6, cursor: ResizeCursor["right"] }
  },
  {
    direction: "top-left",
    style: { top: 0, left: 0, width: 12, height: 12, cursor: ResizeCursor["top-left"] }
  },
  {
    direction: "top-right",
    style: { top: 0, right: 0, width: 12, height: 12, cursor: ResizeCursor["top-right"] }
  },
  {
    direction: "bottom-left",
    style: { bottom: 0, left: 0, width: 12, height: 12, cursor: ResizeCursor["bottom-left"] }
  },
  {
    direction: "bottom-right",
    style: { bottom: 0, right: 0, width: 12, height: 12, cursor: ResizeCursor["bottom-right"] }
  }
] as const;
