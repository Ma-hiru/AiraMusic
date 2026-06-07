import { type FC, memo, useEffect } from "react";
import { useBack } from "@/wins/display/ctx/back";
import { RendererWindow } from "@/common/lib/window";
import { useDisplayTitle } from "@/wins/display/hooks/use-display-title";

import AppMask from "@/common/components/fallback/app-mask";

const BlankDisplay: FC<object> = () => {
  const { back } = useBack();
  const { updateTitle, active } = useDisplayTitle("blank");

  // 退回到最初的路由时，关闭窗口
  useEffect(() => {
    if (!back || !active) return;
    RendererWindow.current.close();
  }, [active, back, updateTitle]);

  useEffect(() => {
    updateTitle("");
  }, [updateTitle]);

  return <AppMask />;
};

export default memo(BlankDisplay);
