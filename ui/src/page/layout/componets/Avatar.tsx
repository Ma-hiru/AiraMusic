import { FC, memo, useEffect, useState } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { css, cx } from "@emotion/css";
import { LogOut, UserRound } from "lucide-react";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

const Avatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const [avatar, setAvatar] = useState<Nullable<string>>(null);
  useEffect(() => {
    data.user?.avatarUrl && wrapCacheUrl(data.user.avatarUrl).then(setAvatar);
  }, [data.user]);
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
              src={avatar as string}
              alt={data.user?.nickname}
              className="size-7 rounded-full cursor-pointer"
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
