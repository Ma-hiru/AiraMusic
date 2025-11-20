import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { css, cx } from "@emotion/css";
import { LogOut, UserRound } from "lucide-react";
import { useCache } from "@mahiru/ui/ctx/CachedCtx";

const Avatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const { cachedURL, init, fail } = useCache(data.user?.avatarUrl);
  return (
    <div
      className={cx(
        "flex justify-between items-center",
        css`
          -webkit-app-region: no-drag;
        `
      )}>
      <div className="flex justify-center items-center gap-2">
        <div className="rounded-full flex justify-center items-center overflow-hidden bg-black/60">
          {data.user?.avatarUrl ? (
            <img
              src={cachedURL as string}
              alt={data.user?.nickname}
              className="size-7 rounded-full cursor-pointer"
              onLoad={init}
              onError={fail}
            />
          ) : (
            <UserRound className="text-white" />
          )}
        </div>
        <span className="text-xs font-bold">{data.user?.nickname || "未登录"}</span>
      </div>
      <LogOut className="size-3 cursor-pointer" />
    </div>
  );
};
export default memo(Avatar);
