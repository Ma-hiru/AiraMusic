import { cx } from "@emotion/css";
import { FC, memo, useMemo } from "react";
import { NeteaseNetworkImage, NeteaseUser } from "@mahiru/ui/public/models/netease";
import { LayoutConfig } from "@mahiru/ui/main/store/layout/config";
import { ChevronDown, UserCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";

interface TopLeftProps {
  user: Nullable<NeteaseUser>;
  layout: LayoutConfig;
  onClick?: NormalFunc;
}

const TopLeft: FC<TopLeftProps> = ({ user, layout, onClick }) => {
  const avatar = useMemo(() => NeteaseNetworkImage.fromUserAvatar(user), [user]);

  return (
    <div
      className="w-40 h-full text-black"
      onClick={() => {
        console.log("click");
      }}>
      <AnimatePresence>
        {!layout.playModal ? (
          <motion.div
            key="user"
            className="w-full h-full flex flex-row px-3 relative top-1 select-none"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.3 } }}>
            <div
              className={`
                w-[calc(50%-var(--spacing)*3)] flex justify-center items-center
                hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all
                select-none
              `}>
              {user?.isLoggedIn ? (
                <NoDrag className="rounded-full" onClick={onClick}>
                  <NeteaseImage
                    preview={false}
                    cache={true}
                    image={avatar}
                    className="size-6.5 rounded-full"
                  />
                </NoDrag>
              ) : (
                <NoDrag onClick={onClick}>
                  <UserCircle2 className="size-6.5 rounded-full" />
                </NoDrag>
              )}
            </div>
            <div
              className={cx(`
                w-[calc(50%+var(--spacing)*3)] flex flex-row
                justify-start items-center pr-3
              `)}>
              <p
                className={cx(
                  `
                  truncate font-semibold text-xs
                  ease-in-out duration-300 transition-opacity
              `,
                  !layout.sideBar && "opacity-0"
                )}>
                {user?.isLoggedIn ? user?.profile.nickname : "未登录"}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            className="w-20 h-full flex items-center justify-center  cursor-pointer"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.3 } }}>
            <NoDrag onClick={onClick}>
              <ChevronDown className="size-5 hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all" />
            </NoDrag>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default memo(TopLeft);
