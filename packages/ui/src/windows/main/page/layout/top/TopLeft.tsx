import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useMemo } from "react";
import { NeteaseNetworkImage, NeteaseUser } from "@mahiru/ui/common/source/netease/models";
import { ChevronDown, UserCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { NeteaseServicesAuth } from "@mahiru/ui/common/source/netease/services";
import { useAtom, useAtomValue } from "jotai";
import { playModalAtom, sidebarAtom } from "@mahiru/ui/windows/main/atoms/layout";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";

import NeteaseImage from "@mahiru/ui/common/components/image/NeteaseImage";
import NoDrag from "@mahiru/ui/common/components/drag/NoDrag";

interface TopLeftProps {
  user: Nullable<NeteaseUser>;
}

const TopLeft: FC<TopLeftProps> = ({ user }) => {
  const avatar = useMemo(() => NeteaseNetworkImage.fromUserAvatar(user), [user]);
  const sideBar = useAtomValue(sidebarAtom);
  const [playModal, setPlayModal] = useAtom(playModalAtom);

  const onClick = useCallback(async () => {
    if (playModal) {
      setPlayModal(false);
    } else if (!NeteaseServicesAuth.isLoggedIn) {
      await NeteaseServicesAuth.createLoginWindow();
    } else {
      await ElectronServicesWindow.display.openAwait();
      ElectronServicesBus.display.send({ type: "settings" });
    }
  }, [playModal, setPlayModal]);

  const AvatarImage = useMemo(() => {
    return (
      <NeteaseImage
        cacheLazy={false}
        preview={false}
        cache={true}
        image={avatar}
        className="size-6.5 rounded-full"
      />
    );
  }, [avatar]);
  return (
    <div className="w-40 h-full text-black">
      <AnimatePresence>
        {!playModal ? (
          <motion.div
            key="user"
            className="w-full h-full flex flex-row px-3 relative top-1 select-none"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0, transition: { ease: "easeIn", duration: 0.6 } }}
            animate={{ opacity: 1, transition: { ease: "easeIn", duration: 0.6 } }}>
            <div
              className={`
                w-[calc(50%-var(--spacing)*3)] flex justify-center items-center
                hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all
                select-none
              `}>
              {user?.isLoggedIn ? (
                <NoDrag className="rounded-full" onClick={onClick}>
                  {AvatarImage}
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
                  !sideBar && "opacity-0"
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
            exit={{ opacity: 0, transition: { ease: "easeIn", duration: 0.6 } }}
            animate={{ opacity: 1, transition: { ease: "easeIn", duration: 0.6 } }}>
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
