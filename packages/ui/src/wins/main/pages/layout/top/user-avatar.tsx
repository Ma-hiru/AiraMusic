import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { UserCircle2 } from "lucide-react";
import { memo, type FC, useMemo } from "react";
import { sidebarAtom } from "@/wins/main/atoms/layout";
import { NeteaseUser, NeteaseNetworkImage } from "@/common/netease/models";
import NoDrag from "@/common/components/layout/drag/no-drag";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface UserAvatarProps {
  user: Nullable<NeteaseUser>;
  onClick?: NormalFunc;
}

const UserAvatar: FC<UserAvatarProps> = ({ user, onClick }) => {
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

export default memo(UserAvatar);
