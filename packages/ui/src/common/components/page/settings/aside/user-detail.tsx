import { type FC, memo, useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { NeteaseNetworkImage, NeteaseUser } from "@/common/netease/models";
import { cx } from "@emotion/css";
import { getCityNameByCode } from "@/common/utils/city-code";
import { RendererFormat } from "@/common/lib/format";

import MiniStat from "./mini-stat";
import Card from "@/common/components/layout/card";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface UserDetailProps {
  user: Nullable<NeteaseUser>;
  logout: NormalFunc;
  login: NormalFunc;
}

const UserDetail: FC<UserDetailProps> = ({ user, logout, login }) => {
  const [city, setCity] = useState<Nullable<string>>(null);
  const profileSignature = user?.profile.signature || "暂无签名";
  const profileName = user?.profile.nickname ?? user?.profile.userId ?? "未登录";
  const avatar = useMemo(() => NeteaseNetworkImage.fromUserAvatar(user)?.setSize(150), [user]);
  const joinTime = RendererFormat.yearsAndDays(user?.profile.createTime);
  const fans = user?.profile.followeds ?? 0;

  useEffect(() => {
    getCityNameByCode(user?.profile?.city).then((name) => setCity(name ?? "未设置"));
  }, [user?.profile?.city]);

  return (
    <Card>
      <div className="flex items-center gap-3">
        {avatar ? (
          <NeteaseImage
            cache
            preview
            cacheLazy={false}
            image={avatar}
            className="
              size-16 rounded-md border border-white/30
              cursor-pointer hover:opacity-50
              ease-in-out duration-300 transition-opacity
            "
            shadow="float"
          />
        ) : (
          <div
            className={`
              flex size-16 items-center justify-center rounded-md
              border border-white/30
              shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.18)]
            `}
            children={<UserRound className="size-8" />}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-xl font-bold tracking-normal">{profileName}</h1>
            <span
              className={cx(
                `text-[10px] font-semibold  rounded-sm px-1.5 border border-white/30`,
                user?.isVIP() && "bg-primary text-primary-text"
              )}>
              VIP
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 opacity-50">{profileSignature}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2">
        <MiniStat label="城市" value={city} />
        <MiniStat label="粉丝" value={fans} />
        <MiniStat label="村龄" value={joinTime} />
      </div>
      <button
        type="button"
        title={user?.isLoggedIn ? "退出登录" : "登录"}
        onClick={user?.isLoggedIn ? logout : login}
        className={cx(
          `
          mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md
          border border-white/30 text-[12px] font-bold
          transition-all duration-300 hover:border-primary/40
          hover:bg-primary hover:text-primary-text
          active:scale-[0.98] cursor-pointer
          `
        )}>
        {user?.isLoggedIn ? (
          <>
            <LogOut className="size-3.5" />
            <span>退出当前账号</span>
          </>
        ) : (
          <>
            <LogIn className="size-3.5" />
            <span>登录</span>
          </>
        )}
      </button>
    </Card>
  );
};

export default memo(UserDetail);
