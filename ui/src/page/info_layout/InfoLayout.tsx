import { FC, memo, useEffect, useState } from "react";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/message";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { useNavigate } from "react-router-dom";
import { Log } from "@mahiru/ui/utils/dev";
import InfoTop from "./InfoTop";
import { InfoCtx } from "@mahiru/ui/ctx/InfoCtx";

const InfoLayout: FC<object> = () => {
  const [show, setShow] = useState(false);
  const [infoSync, setInfoSync] = useState<InfoSync>({
    type: "none",
    id: 0,
    mainColor: "",
    secondaryColor: "",
    textColor: ""
  });

  const navigate = useNavigate();
  useEffect(() => {
    addMessageHandler<InfoSync>((message) => {
      if (message.type === "infoSync" && message.from === "main") {
        if (!show) setShow(true);
        setInfoSync(message.data);
        Log.trace("InfoLayout received infoSync message", message.data);
        const { type, id } = message.data;
        switch (type) {
          case "album":
          case "artist":
          case "musicInfo":
          case "search":
            void navigate(`/info/${type}?id=${id}`);
            break;
          default:
            return;
        }
      }
    }, "info-sync");
    return () => {
      removeMessageHandler("info-sync");
    };
  }, [navigate, show]);
  useEffect(() => {
    Log.trace("InfoLayout loaded");
    window.node.event.loaded({
      broadcast: true,
      showAfterLoaded: false,
      win: "info"
    });
  }, []);
  useEffect(() => {
    if (show) {
      Log.trace("InfoLayout visible");
      window.node.event.visible("info");
    } else {
      Log.trace("InfoLayout hidden");
      window.node.event.hidden("info");
    }
  }, [show]);

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
