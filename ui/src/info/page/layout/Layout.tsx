import Color from "color";
import { FC, memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultInfoCtxValue, InfoCtx } from "../../ctx/InfoCtx";
import { useThemeSyncReceive } from "@mahiru/ui/public/hooks/useThemeSyncReceive";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { Stage } from "@mahiru/ui/public/enum";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";

import InfoTop from "./Top";
import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";
import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";

const Layout: FC<object> = () => {
  const navigate = useNavigate();
  const [infoSync, setInfoSync] = useState<InfoSync<"none">>(defaultInfoCtxValue);
  const { themeSync, requestThemeSync } = useThemeSyncReceive();
  const { requestLoaded } = useAppLoaded(false, { broadcast: true });

  useEffect(() => {
    if (infoSync.type === "none") return;
    navigate(`/info/${infoSync.type}`);
  }, [infoSync.type, navigate]);

  useEffect(() => {
    return Renderer.addMessageHandler("infoSync", ["main", "tray"], setInfoSync);
  }, []);

  useEffect(() => {
    requestThemeSync();
    requestLoaded();
  }, [requestLoaded, requestThemeSync]);
  const { stage } = useStage();
  return (
    <div className="w-screen h-screen bg-white overflow-hidden relative">
      <InfoTop color={Color(themeSync.secondaryColor).darken(0.5).string()} />
      <div
        className="
          w-screen h-screen z-0 bg-[#f7f9fc]
          fixed left-0 top-0 inset-0
      ">
        {stage >= Stage.Finally && (
          <AcrylicBackground src={themeSync.backgroundImage} brightness={0.5} blur={20} />
        )}
      </div>
      <div className="w-screen h-screen relative z-10">
        <InfoCtx.Provider value={infoSync}>
          <KeepAliveOutlet />;
        </InfoCtx.Provider>
      </div>
    </div>
  );
};
export default memo(Layout);
