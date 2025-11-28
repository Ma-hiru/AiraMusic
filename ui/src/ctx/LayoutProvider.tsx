import { ReactNode, useMemo, useState } from "react";
import { LayoutCtx, LayoutCtxType } from "@mahiru/ui/ctx/LayoutCtx";

export default function LayoutProvider({ children }: { children: ReactNode }) {
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [background, setBackground] = useState<Undefinable<string>>();
  const ctxValue = useMemo<LayoutCtxType>(
    () => ({
      PlayerModalVisible: playerModalVisible,
      background,
      setBackground,
      TogglePlayerModalVisible: (visible: boolean) => {
        setPlayerModalVisible(visible);
      }
    }),
    [playerModalVisible, background]
  );
  return <LayoutCtx.Provider value={ctxValue}>{children}</LayoutCtx.Provider>;
}
