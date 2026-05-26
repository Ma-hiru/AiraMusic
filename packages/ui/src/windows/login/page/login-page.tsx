import { useListenable } from "@mahiru/ui/common/hooks/use-listenable";
import { useEffect } from "react";
import { QRCodeStatus, useLoginQRCode } from "@mahiru/ui/windows/login/hooks/use-login-qr-code";
import { useAppLoaded } from "@mahiru/ui/common/hooks/use-app-loaded";
import { ElectronServicesWindow } from "@mahiru/ui/common/source/electron/services";

import QRCode from "./qr-code";
import Tips from "./tips";
import Drag from "../../../common/components/drag/drag";
import TopControlPure from "../../../common/components/top/control";

export default function LoginPage() {
  const { status, result, dataURL, update } = useLoginQRCode();
  const mainWindow = useListenable(ElectronServicesWindow.get("main"));
  const currentWindow = useListenable(ElectronServicesWindow.current);

  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && result) {
      mainWindow.send("login", result.cookie);
      queueMicrotask(() => currentWindow.close());
    }
  }, [currentWindow, mainWindow, result, status]);

  useAppLoaded();
  return (
    <div className="w-screen h-screen overflow-hidden">
      <Drag className="w-screen h-6 flex items-center justify-end absolute top-0 left-0 right-0 p-6 px-5">
        <TopControlPure maximizable={false} />
      </Drag>
      <div className="w-full h-full grid grid-rows-1 grid-cols-[1fr_1fr]">
        <Tips status={status} result={result} />
        <QRCode url={dataURL} update={update} status={status} />
      </div>
    </div>
  );
}
