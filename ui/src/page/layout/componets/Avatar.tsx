import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { css, cx } from "@emotion/css";
import { UserRound } from "lucide-react";

const Avatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  return (
    <div
      className={cx(
        "flex justify-center items-center gap-3 cursor-pointer",
        css`
          -webkit-app-region: no-drag;
        `
      )}>
      <div className="size-5 rounded-full flex justify-center items-center overflow-hidden bg-black/60">
        {data.user?.avatarUrl ? (
          <img
            src={data.user?.avatarUrl}
            alt={data.user?.nickname}
            className="size-5 rounded-full"
          />
        ) : (
          <UserRound className="text-white " />
        )}
      </div>
      <span className="text-xs font-semibold">{data.user?.nickname || "未登录"}</span>
    </div>
  );
};
export default memo(Avatar);
