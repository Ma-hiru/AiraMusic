import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { UserRound } from "lucide-react";
import { useLogin } from "@mahiru/ui/hook/useLogout";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";

const NavAvatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const cachedURL = useFileCache(Filter.NeteaseImageSize(data.user?.avatarUrl, ImageSize.md));
  const login = useLogin();
  const { sideBarOpen } = useLayout();
  return (
    <NoDrag className="flex justify-center items-center relative py-7 px-3 overflow-hidden">
      <div className="rounded-full flex justify-center items-center bg-black/60 size-7 min-w-7">
        {data.user?.avatarUrl ? (
          <img
            src={(cachedURL || null) as string}
            alt={data.user?.nickname}
            loading="lazy"
            decoding="async"
            className="size-7 min-w-7 rounded-full cursor-pointer"
          />
        ) : (
          <UserRound className="text-white cursor-pointer" onClick={login} />
        )}
      </div>
      {sideBarOpen && (
        <span className="text-xs font-bold truncate pl-2">{data.user?.nickname || "未登录"}</span>
      )}
    </NoDrag>
  );
};
export default memo(NavAvatar);
