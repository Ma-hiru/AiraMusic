import { type FC, memo, useEffect } from "react";
import { useBack } from "@/wins/display/ctx/back";
import { useLocation } from "react-router-dom";
import { RoutePathDisplay } from "@/common/routes";
import { RendererWindow } from "@/common/lib/window";

import AppMask from "@/common/components/fallback/app-mask";

const BlankDisplay: FC<object> = () => {
  const { back } = useBack();
  const location = useLocation();

  // 退回到最初的路由时，关闭窗口
  useEffect(() => {
    const active = RoutePathDisplay.match(location, RoutePathDisplay.blank);
    if (!back || !active) return;
    RendererWindow.current.close();
  }, [back, location]);

  return <AppMask />;
};

export default memo(BlankDisplay);
