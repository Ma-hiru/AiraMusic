import { useEffect } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { QRCodeStatus, useLoginQRCode } from "@mahiru/ui/login/hooks/useLoginQRCode";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { Stage } from "@mahiru/ui/public/enum";

import Control from "./Control";
import QRCode from "./QRCode";
import Tips from "./Tips";

export default function LoginPage() {
  const { stage } = useStage();
  const { status, result, dataURL, update } = useLoginQRCode();
  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && result) {
      Renderer.sendMessage("login", "main", result.cookie);
    }
  }, [status, result]);
  useEffect(() => {
    Renderer.event.loaded({ broadcast: true });
    Renderer.addMessageHandler("otherWindowClosed", "main", () => {
      Renderer.event.close({ broadcast: false });
    });
  }, []);
  return (
    <div className="w-screen h-screen overflow-hidden">
      {stage >= Stage.First && <Control />}
      <div className="w-full h-full grid grid-rows-1 grid-cols-[1fr_1fr]">
        {stage >= Stage.Second && <Tips status={status} result={result} />}
        {stage >= Stage.Finally && <QRCode url={dataURL} update={update} status={status} />}
      </div>
    </div>
  );
}
