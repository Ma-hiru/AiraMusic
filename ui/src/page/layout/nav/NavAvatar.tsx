import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { css, cx } from "@emotion/css";
import { UserRound } from "lucide-react";
import { useLogin } from "@mahiru/ui/hook/useLogout";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { AnimatePresence, motion } from "motion/react";

const NavAvatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const cachedURL = useFileCache(Filter.NeteaseImageSize(data.user?.avatarUrl, ImageSize.md));
  const login = useLogin();
  const { sideBarOpen } = useLayout();
  return (
    <div
      className={cx(
        "flex justify-center items-center relative",
        css`
          -webkit-app-region: no-drag;
        `
      )}>
      <div className="flex justify-center items-center gap-2">
        <div className="rounded-full flex justify-center items-center overflow-hidden bg-black/60 size-7">
          {data.user?.avatarUrl ? (
            <img
              src={(cachedURL || null) as string}
              alt={data.user?.nickname}
              loading="lazy"
              decoding="async"
              className="size-7 rounded-full cursor-pointer"
            />
          ) : (
            <UserRound className="text-white cursor-pointer" onClick={login} />
          )}
        </div>

        <AnimatePresence>
          {sideBarOpen && (
            <motion.span
              key="nickname"
              className="text-xs font-bold truncate"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ ease: "easeInOut", duration: 0.3 }}>
              {data.user?.nickname || "未登录"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
export default memo(NavAvatar);
