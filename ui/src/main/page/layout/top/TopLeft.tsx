import { cx } from "@emotion/css";
import { FC, memo, useCallback, useMemo, useRef } from "react";
import { NeteaseNetworkImage, NeteaseUser } from "@mahiru/ui/public/models/netease";
import { LayoutConfig } from "@mahiru/ui/main/store/layout/config";
import { ChevronDown, UserCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import AppAuth from "@mahiru/ui/public/entry/auth";
import AppToast from "@mahiru/ui/public/entry/toast";
import { getLayoutStoreSnapshot } from "@mahiru/ui/main/store/layout";

interface TopLeftProps {
  user: Nullable<NeteaseUser>;
  layout: LayoutConfig;
}

const TopLeft: FC<TopLeftProps> = ({ user, layout }) => {
  const avatar = useMemo(() => NeteaseNetworkImage.fromUserAvatar(user), [user]);

  const updateLayout = getLayoutStoreSnapshot().updateLayout;
  const lastClickTime = useRef(0);
  const onClick = useCallback(() => {
    if (layout.playModal) {
      updateLayout(layout.copy().setPlayModal(false));
    } else if (!AppAuth.isLoggedIn) {
      AppAuth.createLoginWindow();
    } else {
      if (Date.now() - lastClickTime.current < 2000) {
        AppToast.request({
          type: "info",
          text: "再次点击退出登录"
        });
      } else {
        AppAuth.logout().finally(() => {
          AppToast.request({
            type: "success",
            text: "已退出登录"
          });
        });
      }
    }
  }, [layout, updateLayout]);
  return (
    <div className="w-40 h-full text-black">
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
                  truncate font-semibold text-xs text-(--text-color-on-main)
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
              <ChevronDown className="size-5 hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all text-white" />
            </NoDrag>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default memo(TopLeft);
