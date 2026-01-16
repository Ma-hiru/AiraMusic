import { FC, memo, useCallback, useEffect } from "react";
import ToastItem, { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { useImmer } from "use-immer";

interface ToastProviderProps {
  injectContext: NormalFunc<[requestToast: (data: ToastItemData) => void]>;
}

const ToastProvider: FC<ToastProviderProps> = ({ injectContext }) => {
  const [items, setItems] = useImmer<ToastItemData[]>([]);

  const requestToast = useCallback(
    (data: ToastItemData) => {
      setItems((draft) => {
        draft.push(data);
      });
    },
    [setItems]
  );

  const dispose = useCallback(
    (index: number) => {
      setItems((draft) => {
        draft.splice(index, 1);
      });
    },
    [setItems]
  );

  useEffect(() => {
    injectContext(requestToast);
  }, [injectContext, requestToast]);
  return (
    <>
      {items.map((item, index) => {
        return (
          <ToastItem baseDistance={50} data={item} key={index} offset={index} onDispose={dispose} />
        );
      })}
    </>
  );
};
export default memo(ToastProvider);
