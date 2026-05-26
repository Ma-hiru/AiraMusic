import { type FC, memo, useEffect } from "react";
import { useBack } from "@mahiru/ui/windows/display/ctx/back";
import { useLocation } from "react-router-dom";
import { RoutePathDisplay } from "@mahiru/ui/common/routes";
import { ElectronServicesWindow } from "@mahiru/ui/common/source/electron/services";

import AppMask from "../../../../common/components/fallback/app-mask";

const BlankDisplay: FC<object> = () => {
  const { back } = useBack();
  const location = useLocation();

  // 退回到最初的路由时，关闭窗口
  useEffect(() => {
    const active = RoutePathDisplay.match(location, RoutePathDisplay.blank);
    if (!back || !active) return;
    ElectronServicesWindow.current.close();
  }, [back, location]);

  return <AppMask />;
};

export default memo(BlankDisplay);
