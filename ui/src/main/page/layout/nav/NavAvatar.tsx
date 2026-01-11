import { FC, memo } from "react";
import { UserRound } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useLogin, useLogout } from "@mahiru/ui/main/hooks/useLogout";
import { useLocalStore } from "@mahiru/ui/public/store/local";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import NoDrag from "@mahiru/ui/public/components/public/NoDrag";
import NeteaseImage from "@mahiru/ui/public/components/public/NeteaseImage";

const NavAvatar: FC<object> = () => {
  const { SideBarOpen } = useLayoutStore(["SideBarOpen"]);
  const {
    User: { UserProfile }
  } = useLocalStore(["User"]);
  const { mainColor } = useThemeColor();
  const login = useLogin();
  const logout = useLogout();
  return (
    <NoDrag className="w-full flex justify-center items-center relative py-7 overflow-hidden space-x-2">
      {UserProfile?.avatarUrl ? (
        <NeteaseImage
          className="size-7 min-w-7 cursor-pointer select-none rounded-full"
          size={NeteaseImageSize.sm}
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
