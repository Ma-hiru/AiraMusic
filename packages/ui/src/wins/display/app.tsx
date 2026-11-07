import { type FC } from "react";
import { RouterProvider } from "react-router-dom";
import { DisplayRouter } from "@/wins/display/router";
import { useShortcutForwarder } from "@/common/hooks/use-shortcut-forwarder";

const App: FC = () => {
  // 信息窗聚焦时，命中的快捷键转发给主窗口执行
  useShortcutForwarder();
  return <RouterProvider router={DisplayRouter} />;
};

export default App;
