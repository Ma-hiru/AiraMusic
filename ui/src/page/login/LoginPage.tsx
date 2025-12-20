import { FC, memo, useEffect } from "react";
import { QRCodeStatus, useLoginQRCode } from "@mahiru/ui/hook/useLoginQRCode";
import Control from "@mahiru/ui/page/login/Control";
import QRCode from "@mahiru/ui/page/login/QRCode";
import Tips from "@mahiru/ui/page/login/Tips";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";

const LoginPage: FC<object> = () => {
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
};
export default memo(LoginPage);
