import InfoTop from "./InfoTop";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { FC, memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  defaultInfoCtxValue,
  defaultInfoThemeCtxValue,
  InfoCtx,
  InfoThemeCtx
} from "@mahiru/ui/ctx/InfoCtx";
import { Renderer } from "@mahiru/ui/utils/renderer";
import Color from "color";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";

const InfoLayout: FC<object> = () => {
  const navigate = useNavigate();
  const [infoSync, setInfoSync] = useState<InfoSync<"none">>(defaultInfoCtxValue);
  const [themeSync, setThemeSync] = useState<InfoSync<"theme">>(defaultInfoThemeCtxValue);

  useEffect(() => {
    if (infoSync.type === "none") return;
    navigate(`/info/${infoSync.type}`);
  }, [infoSync.type, navigate]);

  useEffect(() => {
    const remove = Renderer.addMessageHandler("infoSync", "main", (sync) => {
      if (sync.type === "theme") {
        setThemeSync(sync);
      } else {
        setInfoSync(sync);
      }
    });
    return () => {
      remove();
    };
  }, []);

  useEffect(() => {
    Renderer.event.loaded({ broadcast: true });
  }, []);
  const { stage } = useStage();
  return (
    <div className="w-screen h-screen bg-white overflow-hidden relative">
      <InfoTop color={Color(themeSync.value.secondaryColor).darken(0.5).string()} />
      <div
        className="
          w-screen h-screen z-0 bg-[#f7f9fc]
          fixed left-0 top-0 inset-0
      ">
        {stage >= Stage.Finally && (
          <AcrylicBackground src={themeSync.value.backgroundImage} brightness={0.5} blur={20} />
        )}
      </div>
      <div className="w-full h-full relative z-10">
        <InfoCtx.Provider value={infoSync}>
          <InfoThemeCtx value={themeSync}>
            <KeepAliveOutlet />;
          </InfoThemeCtx>
        </InfoCtx.Provider>
      </div>
    </div>
  );
};
export default memo(InfoLayout);
