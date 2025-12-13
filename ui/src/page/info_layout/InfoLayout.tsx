import InfoTop from "./InfoTop";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { FC, memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InfoCtx } from "@mahiru/ui/ctx/InfoCtx";
import { Renderer } from "@mahiru/ui/utils/renderer";

const InfoLayout: FC<object> = () => {
  const navigate = useNavigate();
  const [infoSync, setInfoSync] = useState<InfoSync>({
    type: "none",
    value: 0,
    mainColor: "",
    secondaryColor: "",
    textColor: ""
  });

  useEffect(() => {
    switch (infoSync.type) {
      case "musicInfo":
        navigate("/info/musicInfo");
        break;
      case "album":
        navigate("/info/album");
        break;
      case "artist":
        navigate("/info/artist");
        break;
      case "search":
        navigate("/info/search");
    }
  }, [infoSync.type, navigate]);

  useEffect(() => {
    const remove = Renderer.addMessageHandler("infoSync", "main", setInfoSync);
    Renderer.event.loaded({ broadcast: true });
    return () => {
      remove();
    };
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
