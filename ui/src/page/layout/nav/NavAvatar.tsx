import { FC, memo } from "react";
import { useLayoutStatus, usePersistZustandShallowStore } from "@mahiru/ui/store";
import { UserRound } from "lucide-react";
import { useLogin, useLogout } from "@mahiru/ui/hook/useLogout";
import { ImageSize } from "@mahiru/ui/utils/filter";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const NavAvatar: FC<object> = () => {
  const { sideBarOpen } = useLayoutStatus(["sideBarOpen"]);
  const { data } = usePersistZustandShallowStore(["data"]);
  const { mainColor } = useThemeColor();
  const login = useLogin();
  const logout = useLogout();
  return (
    <NoDrag className="w-full flex justify-center items-center relative py-7 overflow-hidden space-x-2">
      {data.user?.avatarUrl ? (
        <NeteaseImage
          className="size-7 min-w-7 cursor-pointer select-none rounded-full"
          size={ImageSize.md}
          onClick={logout}
          src={data.user?.avatarUrl}
          alt={data.user?.nickname}
          shadowColor={mainColor.isDark() ? "dark" : "light"}
        />
      ) : (
        <div className="bg-black/60 size-7 min-w-7 cursor-pointer rounded-full hover:opacity-50 select-none">
          <UserRound className="text-white" onClick={login} />
        </div>
      )}
      {sideBarOpen && (
        <span className="text-xs font-bold truncate">{data.user?.nickname || "未登录"}</span>
      )}
    </NoDrag>
  );
};
export default memo(NavAvatar);
