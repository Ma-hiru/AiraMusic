import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { useNavigate } from "react-router-dom";
import { RoutePathMain } from "@/common/routes";
import { useAtom, useAtomValue } from "jotai";
import { playModalAtom, scrollActionsAtom, sidebarAtom } from "@/wins/main/atoms/layout";
import { useRouterActive } from "@/common/hooks/use-router-active";

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
      onBack={isHome ? null : () => navigate(-1)}
      sidebar={{ open: sidebar, toggle: () => setSidebar(!sidebar) }}
    />
  );
};

export default memo(MainFloat);
