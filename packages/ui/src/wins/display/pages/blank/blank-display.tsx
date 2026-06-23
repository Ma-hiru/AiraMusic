import { type FC, memo, useEffect } from "react";
import { useBack } from "@/wins/display/ctx/back";
import { RendererWindow } from "@/common/lib/window";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";

import AppMask from "@/common/components/fallback/app-mask";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { RoutePathDisplay } from "@/common/routes";

const BlankDisplay: FC<object> = () => {
  const { back } = useBack();
  const active = useRouterActive(RoutePathDisplay, "base");
  useDisplayTitleRegister("blank", import.meta.env.APP_NAME);

  // 退回到最初的路由时，关闭窗口
  useEffect(() => {
    if (!back || !active) return;
    RendererWindow.current.close();
  }, [active, back]);

  return <AppMask />;
};

export default memo(BlankDisplay);
