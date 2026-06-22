import { type FC, memo, useEffect } from "react";
import { useBack } from "@/wins/display/ctx/back";
import { RendererWindow } from "@/common/lib/window";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";

import AppMask from "@/common/components/fallback/app-mask";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { RoutePathDisplay } from "@/common/routes";

const BlankDisplay: FC<object> = () => {
  const { back } = useBack();
  const { registerTitle } = useDisplayTitleRegister();
  const active = useRouterActive(RoutePathDisplay, "base");

  // 退回到最初的路由时，关闭窗口
  useEffect(() => {
    if (!back || !active) return;
    RendererWindow.current.close();
  }, [active, back]);

  useEffect(() => {
    registerTitle(import.meta.env.APP_NAME);
  }, [registerTitle]);

  return <AppMask />;
};

export default memo(BlankDisplay);
