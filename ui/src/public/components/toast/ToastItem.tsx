import {
  memo,
  forwardRef,
  ForwardRefRenderFunction,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState
} from "react";
import { motion, useAnimate } from "motion/react";

export type ToastItemData = {
  type: "info" | "error" | "warn" | "success";
  text: string;
};

export interface ToastItemRef {
  dispose: PromiseFunc;
}

interface ToastItemProps {
  data: ToastItemData;
  baseDistance: number;
  offset: number;
  duration?: number;
  onDispose?: NormalFunc<[offset: number]>;
}

const ToastItem: ForwardRefRenderFunction<ToastItemRef, ToastItemProps> = (
  { data, baseDistance, offset, duration = 5000, onDispose },
  ref
) => {
  const [render, setRender] = useState(true);
  const [scope, animate] = useAnimate();

  const dispose = useCallback(async () => {
    await animate(
      scope.current,
      {
        opacity: 0,
        scale: 0,
        top: 0
      },
      {
        duration: 0.5,
        ease: "easeInOut"
      }
    );
    setRender(false);
    onDispose?.(offset);
  }, [animate, scope]);

  useEffect(() => {
    animate(
      scope.current,
      {
        opacity: 1,
        scale: 1,
        top: baseDistance + offset * 50
      },
      {
        duration: 0.5,
        ease: "easeInOut"
      }
    );

    let timer: Undefinable<number>;
    if (duration) {
      timer = window.setTimeout(() => {
        void dispose();
      }, duration);
    }

    return () => {
      timer && window.clearTimeout(timer);
      void dispose();
    };
  }, [animate, baseDistance, dispose, duration, offset, scope]);

  useImperativeHandle(
    ref,
    () => ({
      dispose
    }),
    [dispose]
  );

  return (
    render && (
      <motion.div
        ref={scope}
        className="fixed left-1/2 -translate-x-1/2 z-50"
        initial={{ opacity: 0, scale: 0, top: 0 }}>
        {data.type} - {data.text}
      </motion.div>
    )
  );
};

ToastItem.displayName = "ToastItem";
export default memo(forwardRef(ToastItem));
