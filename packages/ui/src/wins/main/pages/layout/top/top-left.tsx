import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useMemo } from "react";
import { NeteaseNetworkImage, NeteaseUser } from "@/common/netease/models";
import { ChevronDown, UserCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { useAtom, useAtomValue } from "jotai";
import { playModalAtom, sidebarAtom } from "@/wins/main/atoms/layout";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";

import NeteaseImage from "@/common/components/display/image/netease-image";
import NoDrag from "@/common/components/layout/drag/no-drag";
import RendererImageConstants from "@/common/constants/image";

interface TopLeftProps {
  user: Nullable<NeteaseUser>;
}

const TopLeft: FC<TopLeftProps> = ({ user }) => {
  const [playModal, setPlayModal] = useAtom(playModalAtom);

  const onClick = useCallback(async () => {
    if (playModal) {
      setPlayModal(false);
    } else if (!NeteaseServicesAuth.isLoggedIn) {
      await NeteaseServicesAuth.createLoginWindow();
    } else {
      await RendererWindow.display.reactReadyAwait();
      RendererIPCMessageBus.display.deliver({ type: "settings" });
    }
  }, [playModal, setPlayModal]);

  return (
    <div className="w-40 h-full">
      <AnimatePresence>
        {!playModal ? (
          <motion.div
            key="user"
            className="w-full h-full flex flex-row px-3 relative top-1 select-none"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.5 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.3 } }}
            children={<UserInfo user={user} onClick={onClick} />}
          />
        ) : (
          <motion.div
            key="back"
            className="w-20 h-full flex items-center justify-center  cursor-pointer"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.3 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.6 } }}>
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

const UserInfo = ({ user, onClick }: { user: Nullable<NeteaseUser>; onClick?: NormalFunc }) => {
  const sideBar = useAtomValue(sidebarAtom);
  const loggedIn = useMemo(() => user?.isLoggedIn, [user]);
  const avatar = useMemo(
    () =>
      NeteaseNetworkImage.fromUserAvatar(user)?.setSize(RendererImageConstants.TopMiniAvatarSize),
    [user]
  );
  const AvatarImage = useMemo(() => {
    if (!user) return null;
    return (
      <NeteaseImage
        title={user?.profile.nickname}
        cacheLazy={false}
        preview={false}
        cache={true}
        image={avatar}
        className="size-6.5 rounded-full"
      />
    );
  }, [avatar, user]);

  return (
    <>
      <div
        className={`
          w-[calc(50%-var(--spacing)*3)] flex justify-center items-center cursor-pointer
          hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all
        `}>
        {loggedIn ? (
          <NoDrag className="rounded-full border border-normal-text shadow-sm" onClick={onClick}>
            {AvatarImage}
          </NoDrag>
        ) : (
          <NoDrag onClick={onClick}>
            <UserCircle2 className="size-6.5 rounded-full" />
          </NoDrag>
        )}
      </div>
      <div
        className={cx(
          `
          w-[calc(50%+var(--spacing)*3)] flex flex-row
          justify-start items-center pr-3
        `
        )}>
        <p
          className={cx(
            `
            truncate font-semibold text-xs leading-tight tracking-normal
            ease-in-out duration-300 transition-opacity
          `,
            !sideBar && "opacity-0"
          )}>
          {loggedIn ? user?.profile.nickname : "未登录"}
        </p>
      </div>
    </>
  );
};
