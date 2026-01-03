import { FC, memo } from "react";
import { UserRound } from "lucide-react";
import { useLogin, useLogout } from "@mahiru/ui/hook/useLogout";
import { NeteaseImageSize } from "@mahiru/ui/utils/image";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import { useUserStore } from "@mahiru/ui/store/user";

const NavAvatar: FC<object> = () => {
  const { SideBarOpen } = useLayoutStore(["SideBarOpen"]);
  const { UserProfile } = useUserStore(["UserProfile"]);
  const { mainColor } = useThemeColor();
  const login = useLogin();
  const logout = useLogout();
  return (
    <NoDrag className="w-full flex justify-center items-center relative py-7 overflow-hidden space-x-2">
      {UserProfile?.avatarUrl ? (
        <NeteaseImage
          className="size-7 min-w-7 cursor-pointer select-none rounded-full"
          size={NeteaseImageSize.md}
          onClick={logout}
          src={UserProfile?.avatarUrl}
          alt={UserProfile?.nickname}
          shadowColor={mainColor.isDark() ? "dark" : "light"}
        />
      ) : (
        <div className="bg-black/60 size-7 min-w-7 cursor-pointer rounded-full hover:opacity-50 select-none">
          <UserRound className="text-white" onClick={login} />
        </div>
      )}
      {SideBarOpen && (
        <span className="text-xs font-bold truncate">{UserProfile?.nickname || "未登录"}</span>
      )}
    </NoDrag>
  );
};
export default memo(NavAvatar);
