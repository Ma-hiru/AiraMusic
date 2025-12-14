import InfoTop from "./InfoTop";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { FC, memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InfoCtx } from "@mahiru/ui/ctx/InfoCtx";
import { Renderer } from "@mahiru/ui/utils/renderer";

const InfoLayout: FC<object> = () => {
  const navigate = useNavigate();
  const [infoSync, setInfoSync] = useState<InfoSync<"none">>({
    type: "none",
    value: undefined,
    mainColor: "",
    secondaryColor: "",
    textColor: ""
  });

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
      <InfoTop />
      <InfoCtx.Provider value={infoSync}>
        <KeepAliveOutlet />;
      </InfoCtx.Provider>
    </div>
  );
};
export default memo(InfoLayout);
