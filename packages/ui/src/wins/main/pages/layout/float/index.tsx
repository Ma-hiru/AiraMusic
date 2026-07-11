import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useNavigate } from "react-router-dom";
import { RoutePathMain } from "@/common/routes";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { sidebarAtom, playModalAtom, scrollActionsAtom } from "@/wins/main/atoms/layout";
import Float from "@/common/components/layout/float";

const MainFloat: FC<{ className?: string }> = ({ className }) => {
  const playModal = useAtomValue(playModalAtom);
  const scrollActions = useAtomValue(scrollActionsAtom);
  const [sidebar, setSidebar] = useAtom(sidebarAtom);
  const navigate = useNavigate();

  // 在首页或根路径时不显示返回按钮
  const isHome = useRouterActive(RoutePathMain, "home");

  return (
    <Float
      className={cx("right-6 bottom-24", className)}
      hidden={playModal}
      scrollTop={scrollActions.scrollTop}
      fastLocate={scrollActions.fastLocate}
      sidebar={{ open: sidebar, toggle: () => setSidebar(!sidebar) }}
      onBack={isHome ? null : () => navigate(-1)}
    />
  );
};

export default memo(MainFloat);
