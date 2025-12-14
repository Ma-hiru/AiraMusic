import { FC, memo } from "react";
import { useLayoutStatus, usePersistZustandShallowStore } from "@mahiru/ui/store";
import { UserRound } from "lucide-react";
import { useLogin, useLogout } from "@mahiru/ui/hook/useLogout";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";

const NavAvatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const cachedURL = useFileCache(Filter.NeteaseImageSize(data.user?.avatarUrl, ImageSize.md));
  const login = useLogin();
  const logout = useLogout();
  const { sideBarOpen } = useLayoutStatus(["sideBarOpen"]);
  return (
    <NoDrag className="w-full flex justify-center items-center relative py-7 overflow-hidden space-x-2">
      {data.user?.avatarUrl ? (
        <div className="size-7 min-w-7 cursor-pointer select-none">
          <img
            onClick={logout}
            src={(cachedURL || null) as string}
            alt={data.user?.nickname}
            loading="lazy"
            decoding="async"
            className="w-full h-full rounded-full"
          />
        </div>
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
