import { useAtom } from "jotai";
import { cx } from "@emotion/css";
import { ChevronDown } from "lucide-react";
import { memo, type FC, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RendererDevice } from "@/common/lib/device";
import { playModalAtom } from "@/wins/main/atoms/layout";
import NoDrag from "@/common/components/layout/drag/no-drag";

const isDarwin = (await RendererDevice.platform) === "darwin";

const TopBack: FC = () => {
  const [playModal, setPlayModal] = useAtom(playModalAtom);
  const onClick = useCallback(() => setPlayModal(false), [setPlayModal]);
  return (
    <AnimatePresence>
      {playModal && (
        <motion.div
          key="back"
          className={cx("absolute top-1.5 left-4 z-50", isDarwin && "left-20!")}
          initial={{ opacity: 0 }}
          exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
          animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.6 } }}>
          <NoDrag>
            <ChevronDown
              className="size-5 cursor-pointer hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all text-white"
              onClick={onClick}
            />
          </NoDrag>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(TopBack);
