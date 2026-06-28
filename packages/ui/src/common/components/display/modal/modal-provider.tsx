import {
  type CSSProperties,
  type FC,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cx } from "@emotion/css";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { ensureInjectObject, useInject } from "@/common/utils/inject";
import AppModal from "./use";

export type ModalRender = {
  title?: ReactNode;
  subTitle?: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  closeOnMask?: boolean;
  className?: string;
  contentClassName?: string;
  onClose?: NormalFunc<[], void | boolean>;
  hiddenMaskBlur?: boolean;
};

const ModalProvider: FC<{ className?: string }> = ({ className }) => {
  const [render, setRender] = useState<Nullable<ModalRender>>(null);
  const [visible, setVisible] = useState(false);
  const renderRef = useLatestRef(render);
  const visibleRef = useLatestRef(visible);

  const setModalRenderData = setRender;

  const setModalVisible = useCallback((show?: boolean) => {
    if (typeof show === "boolean") {
      setVisible(show);
    } else {
      setVisible((v) => !v);
    }
  }, []);

  const getRender = useRef(() => renderRef.current).current;
  const getVisible = useRef(() => visibleRef.current).current;

  const close = useCallback(() => {
    const result = renderRef.current?.onClose?.();
    if (typeof result === "boolean") {
      setVisible(result);
    } else {
      setVisible(false);
    }
  }, [renderRef]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, visible]);

  useInject(ensureInjectObject(AppModal), {
    __setModalData: setModalRenderData,
    __visibleGetter: getVisible,
    __setModalVisible: setModalVisible,
    __renderGetter: getRender
  });

  return (
    <div>
      <button
        className={cx(
          "fixed inset-0 cursor-default bg-black/30",
          render?.hiddenMaskBlur ? "backdrop-blur-none" : "backdrop-saturate-150 backdrop-blur-lg",
          !(visible && render) && "hidden",
          className
        )}
        onClick={() => (render?.closeOnMask ?? true) && close()}
      />
      <AnimatePresence mode="sync" onExitComplete={() => !visible && setRender(null)}>
        {visible && render && (
          <motion.div
            key="modal"
            className={cx(
              `
              fixed inset-0 flex items-center justify-center
              px-5 py-7 pointer-events-none
            `,
              className
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
            exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeInOut" } }}>
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label={typeof render.title === "string" ? render.title : "弹窗"}
              className={cx(
                `
                relative z-10 grid max-h-[min(86vh,720px)] w-full max-w-[calc(100vw-2rem)]
                grid-rows-[auto_1fr_auto] overflow-hidden rounded-lg pointer-events-auto
                surface-popover
              `,
                render.className
              )}
              style={{
                width: render.width ?? 720,
                height: render.height
              }}
              initial={{ opacity: 0, scale: 0.97, y: 24 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
                y: 18,
                transition: { duration: 0.2, ease: "easeInOut" }
              }}>
              {!!(render.title || render.subTitle) && (
                <header className="flex min-h-14 items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    {render.subTitle && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-50">
                        {render.subTitle}
                      </p>
                    )}
                    {render.title && (
                      <h2 className="mt-0.5 truncate text-lg font-bold tracking-normal">
                        {render.title}
                      </h2>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="关闭弹窗"
                    onClick={close}
                    className={`
                      flex size-8 shrink-0 items-center justify-center
                      transition-all duration-300 ease-in-out
                      hover:opacity-50 active:scale-95 cursor-pointer
                    `}>
                    <X className="size-4" />
                  </button>
                </header>
              )}
              <div
                className={cx(
                  "min-h-0 overflow-y-auto px-4 pb-4 scrollbar scrollbar-show",
                  render.contentClassName
                )}>
                {render.content}
              </div>
              {render.footer && (
                <footer className="border-t border-white/10 px-4 py-3">{render.footer}</footer>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(ModalProvider);
