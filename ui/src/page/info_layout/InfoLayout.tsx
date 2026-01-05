import InfoTop from "./InfoTop";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { FC, memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultInfoCtxValue, InfoCtx } from "@mahiru/ui/ctx/InfoCtx";
import { Renderer } from "@mahiru/ui/utils/renderer";
import Color from "color";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { useThemeSyncReceive } from "@mahiru/ui/hook/useThemeSyncReceive";

const InfoLayout: FC<object> = () => {
  const navigate = useNavigate();
  const [infoSync, setInfoSync] = useState<InfoSync<"none">>(defaultInfoCtxValue);
  const { themeSync } = useThemeSyncReceive();

  useEffect(() => {
    if (infoSync.type === "none") return;
    navigate(`/info/${infoSync.type}`);
  }, [infoSync.type, navigate]);

  useEffect(() => {
    return Renderer.addMessageHandler("infoSync", "main", setInfoSync);
  }, []);

  useEffect(() => {
    Renderer.event.loaded({ broadcast: true });
  }, []);
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
export default memo(InfoLayout);
