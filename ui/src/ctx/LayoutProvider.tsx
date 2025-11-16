import { ReactNode, useMemo, useState } from "react";
import { LayoutCtx, LayoutCtxType } from "@mahiru/ui/ctx/LayoutCtx";

export default function LayoutProvider({ children }: { children: ReactNode }) {
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const ctxValue = useMemo<LayoutCtxType>(
    () => ({
      PlayerModalVisible: playerModalVisible,
      TogglePlayerModalVisible: (visible: boolean) => {
        setPlayerModalVisible(visible);
      }
    }),
    [playerModalVisible]
  );
  return <LayoutCtx.Provider value={ctxValue}>{children}</LayoutCtx.Provider>;
}
