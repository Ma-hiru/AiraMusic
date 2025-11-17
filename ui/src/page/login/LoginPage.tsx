import { FC, memo, useEffect } from "react";
import { QRCodeStatus, useQRCode } from "@mahiru/ui/hook/useQRCode";
import Control from "@mahiru/ui/page/login/Control";
import QRCode from "@mahiru/ui/page/login/QRCode";
import Tips from "@mahiru/ui/page/login/Tips";

const LoginPage: FC<object> = () => {
  const { status, result, dataURL, update } = useQRCode();
  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && result) {
      window.node.event.sendMessageTo({
        from: "login",
        to: "main",
        data: result.cookie,
        type: "login"
      });
      window.node.event.close("login");
    }
  }, [status, result]);
  return (
    <div className="w-screen h-screen overflow-hidden">
      <Control />
      <div className="w-full h-full grid grid-rows-1 grid-cols-[1fr_1fr]">
        <Tips status={status} result={result} />
        <QRCode url={dataURL} update={update} status={status} />
      </div>
    </div>
  );
};
export default memo(LoginPage);
