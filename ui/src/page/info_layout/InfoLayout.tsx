import InfoTop from "./InfoTop";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { FC, memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defaultInfoCtxValue, InfoCtx } from "@mahiru/ui/ctx/InfoCtx";
import { Renderer } from "@mahiru/ui/utils/renderer";
import Color from "color";

const InfoLayout: FC<object> = () => {
  const navigate = useNavigate();
  const [infoSync, setInfoSync] = useState<InfoSync<"none">>(defaultInfoCtxValue);

  useEffect(() => {
    if (infoSync.type === "none") return;
    navigate(`/info/${infoSync.type}`);
  }, [infoSync.type, navigate]);

  useEffect(() => {
    const remove = Renderer.addMessageHandler("infoSync", "main", setInfoSync);
    return () => {
      remove();
    };
  }, []);

  useEffect(() => {
    Renderer.event.loaded({ broadcast: true });
  }, []);
  return (
    <div className="w-screen h-screen bg-white overflow-hidden">
      <InfoTop color={Color(infoSync.secondaryColor).darken(0.5).string()} />
      <InfoCtx.Provider value={infoSync}>
        <KeepAliveOutlet />;
      </InfoCtx.Provider>
    </div>
  );
};
export default memo(InfoLayout);
