import { memo, type FC } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NeteaseUser } from "@/common/netease/models";
import UserAvatar from "@/wins/main/pages/layout/top/user-avatar";

interface TopLeftProps {
  isDarwin?: boolean;
  playModal?: boolean;
  user: Nullable<NeteaseUser>;
  onClick?: NormalFunc;
}

const TopLeft: FC<TopLeftProps> = ({ user, onClick, isDarwin, playModal }) => {
  if (isDarwin) return;
  return (
    <div className="w-40 h-full">
      <AnimatePresence>
        {!playModal && (
          <motion.div
            key="user"
            className="w-full h-full overflow-hidden flex flex-row px-3 relative top-1 select-none"
            initial={{ opacity: 0 }}
            children={<UserAvatar user={user} onClick={onClick} />}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.5 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.3 } }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(TopLeft);
