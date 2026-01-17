import { FC, memo, useCallback, useLayoutEffect } from "react";
import { useImmer } from "use-immer";
import { AnimatePresence, motion } from "motion/react";

import ToastItem, { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";

const MotionToastItem = motion(ToastItem);

interface ToastProviderProps {
  injectContext: NormalFunc<[requestToast: (data: Omit<ToastItemData, "id">) => void]>;
}

const ToastProvider: FC<ToastProviderProps> = ({ injectContext }) => {
  const [items, setItems] = useImmer<ToastItemData[]>([]);

  const requestToast = useCallback(
    (data: Omit<ToastItemData, "id">) => {
      setItems((draft) => {
        draft.push({ ...data, id: window.crypto.randomUUID() });
        if (draft.length > 5) draft.shift();
      });
    },
    [setItems]
  );

  const dispose = useCallback(
    (id: string) => {
      setItems((draft) => {
        const index = draft.findIndex((item) => item.id === id);
        if (index !== -1) {
          draft.splice(index, 1);
        }
      });
    },
    [setItems]
  );

  useLayoutEffect(() => {
    injectContext(requestToast);
  }, [injectContext, requestToast]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {items.map((item) =>
          // prettier-ignore
          <MotionToastItem
            data={item}
            key={item.id}
            id={item.id}
            onDispose={dispose}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
export default memo(ToastProvider);
