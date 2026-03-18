import { useEffect } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { QRCodeStatus, useLoginQRCode } from "@mahiru/ui/login/hooks/useLoginQRCode";
import { Stage } from "@mahiru/ui/public/enum";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";

import Control from "./Control";
import QRCode from "./QRCode";
import Tips from "./Tips";
import AppRenderer from "@mahiru/ui/public/entry/renderer";

export default function LoginPage() {
  useAppLoaded(true, { broadcast: true });

  const { stage } = useStage();
  const { status, result, dataURL, update } = useLoginQRCode();
  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && result) {
      AppRenderer.sendMessage("login", "main", result.cookie);
      setTimeout(() => {
        AppRenderer.event.close({ broadcast: true });
      }, 1000);
    }
  }, [status, result]);

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
