import {
  FC,
  memo,
  ReactNode,
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { motion, useAnimate } from "motion/react";
import { X } from "lucide-react";
import { cx } from "@emotion/css";
import { injectModal } from "@mahiru/ui/public/hooks/useModal";

export type ModalData = {
  content: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  width?: number | "auto" | `${number}%`;
  height?: number | "auto" | `${number}%`;
  onClose?: NormalFunc<[], void | boolean>;
};

const ModalProvider: FC<object> = () => {
  const [render, setRender] = useState<Nullable<ModalData>>(null);
  const [visible, setVisible] = useState(false);
  const [scope, animate] = useAnimate();

  const renderRef = useRef(render);
  const visibleRef = useRef(visible);
  renderRef.current = render;
  visibleRef.current = visible;

  const toggleModalVisible = useCallback((visible?: boolean) => {
    if (typeof visible === "boolean") setVisible(visible);
    else setVisible((v) => !v);
  }, []);

  const setModalRenderData = setRender;

  const getRender = useRef(() => renderRef.current).current;

  const getVisible = useRef(() => visibleRef.current).current;

  const openAnimate = useCallback(async () => {
    const render = getRender();
    if (!render) return;
    await animate(scope.current);
  }, [animate, getRender, scope]);

  const closeAnimate = useCallback(async () => {
    await animate(scope.current);
  }, [animate, scope]);

  useLayoutEffect(() => {
    if (visible) {
      closeAnimate().then(openAnimate);
    } else {
      void closeAnimate();
    }
  }, [closeAnimate, openAnimate, visible]);

  useLayoutEffect(() => {
    injectModal({
      toggleModalVisible,
      setModalRenderData,
      getRender,
      getVisible
    });
  }, [getRender, getVisible, setModalRenderData, toggleModalVisible]);

  const hidden = !useDeferredValue(visible && !!render);

  const handleClose = useCallback(() => {
    const res = render?.onClose?.();
    if (typeof res === "boolean") {
      toggleModalVisible(res);
    } else {
      toggleModalVisible(false);
    }
  }, [render, toggleModalVisible]);

  return (
    <div className={cx(`fixed inset-0 z-50 flex items-center justify-center`, hidden && "hidden")}>
      <div className="absolute inset-0 z-0 bg-black/10" onClick={handleClose} />
      <motion.div
        ref={scope}
        className="z-50 p-2 relative bg-white/20 backdrop-blur-md border border-white/30 rounded-md shadow-lg grid grid-cols-1 grid-rows-[auto_1fr_auto]"
        style={{ height: render?.height, width: render?.width }}>
        <X className="absolute right-0.5 top-0.5 size-4" color="#000000" onClick={handleClose} />
        <div>{render?.header}</div>
        <div>{render?.content}</div>
        <div>{render?.footer}</div>
      </motion.div>
    </div>
  );
};
export default memo(ModalProvider);
