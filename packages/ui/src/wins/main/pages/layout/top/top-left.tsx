import { memo, type FC } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { NeteaseUser } from "@/common/netease/models";
import NoDrag from "@/common/components/layout/drag/no-drag";
import UserAvatar from "@/wins/main/pages/layout/top/user-avatar";

interface TopLeftProps {
  isDarwin?: boolean;
  playModal?: boolean;
  user: Nullable<NeteaseUser>;
  onClick?: NormalFunc;
}

const TopLeft: FC<TopLeftProps> = ({ user, onClick, isDarwin, playModal }) => {
  return (
    <div className="w-40 h-full">
      <AnimatePresence>
        {!playModal ? (
          <motion.div
            key="user"
            className="w-full h-full overflow-hidden flex flex-row px-3 relative top-1 select-none"
            initial={{ opacity: 0 }}
            children={!isDarwin && <UserAvatar user={user} onClick={onClick} />}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.5 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.3 } }}
          />
        ) : (
          <motion.div
            key="back"
            className="w-20 h-full flex items-center justify-center cursor-pointer"
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.6 } }}
            initial={
              !isDarwin
                ? { opacity: 0 }
                : {
                    position: "relative",
                    top: "6px",
                    left: "16px",
                    justifyContent: "flex-end",
                    alignItems: "flex-start"
                  }
            }>
            <NoDrag onClick={onClick}>
              <ChevronDown className="size-5 hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all text-white" />
            </NoDrag>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(TopLeft);
