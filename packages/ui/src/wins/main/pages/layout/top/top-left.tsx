import { cx } from "@emotion/css";
import { useAtom, useAtomValue } from "jotai";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, UserCircle2 } from "lucide-react";
import { memo, type FC, useMemo, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { sidebarAtom, playModalAtom } from "@/wins/main/atoms/layout";
import { NeteaseUser, NeteaseNetworkImage } from "@/common/netease/models";
import NoDrag from "@/common/components/layout/drag/no-drag";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";

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
            children={<UserInfo user={user} onClick={onClick} />}
            exit={{ opacity: 0, transition: { ease: "easeInOut", duration: 0.5 } }}
            animate={{ opacity: 1, transition: { ease: "easeInOut", duration: 0.3 } }}
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

const UserInfo = ({ user, onClick }: { onClick?: NormalFunc; user: Nullable<NeteaseUser> }) => {
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
        className="size-6.5 rounded-full"
        cache={true}
        image={avatar}
        preview={false}
        cacheLazy={false}
        title={user?.profile.nickname}
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
