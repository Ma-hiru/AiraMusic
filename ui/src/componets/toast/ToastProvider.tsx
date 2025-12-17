import { FC, memo, useCallback, useEffect, useState } from "react";
import { usePlayerStatus } from "@mahiru/ui/store";
import { useImmer } from "use-immer";
import { Time } from "@mahiru/ui/utils/time";
import { AnimatePresence, motion } from "motion/react";

const ToastProvider: FC<object> = () => {
  const [timeLimit, setTimeLimit] = useState(Time.getCacheTimeLimit(4, "seconds"));
  const [showToast, setShowToast] = useImmer<{ content: string; create: number }[]>([]);
  const { toast, clearToast } = usePlayerStatus(["toast", "clearToast"]);

  const checkToast = useCallback(() => {
    setShowToast((draft) => {
      return draft.filter((toast) => Date.now() - toast.create <= timeLimit);
    });
  }, [setShowToast, timeLimit]);

  useEffect(() => {
    if (toast.length) {
      setShowToast((draft) => {
        draft.push(
          ...toast.map((t) => ({
            content: t,
            create: Date.now()
          }))
        );
      });
      clearToast();
    }
  }, [clearToast, setShowToast, showToast, toast]);
  useEffect(() => {
    if (!showToast.length) return;
    const timer = setInterval(checkToast, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [checkToast, showToast.length]);
  return (
    <div className="fixed left-1/2 top-5 -translate-x-1/2 flex justify-center items-center flex-col-reverse">
      <AnimatePresence>
        {showToast.map((toast) => {
          return (
            <motion.div
              key={toast.create}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                ease: "easeInOut",
                duration: 0.8
              }}
              exit={{
                opacity: 0,
                scale: 0
              }}>
              {toast.content}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
export default memo(ToastProvider);
