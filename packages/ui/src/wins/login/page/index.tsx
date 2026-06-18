import { useListenable } from "@/common/hooks/use-listenable";
import { useEffect } from "react";
import { QRCodeStatus, useLoginQRCode } from "@/wins/login/hooks/use-login-qr-code";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import { RendererWindow } from "@/common/lib/window";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";

import QRCode from "./qr-code";
import Tips from "./tips";
import Drag from "@/common/components/layout/drag/drag";
import TopControlPure from "@/common/components/layout/top/control";
import AcrylicBackground from "@/common/components/display/acrylic-background";

export default function LoginPage() {
  useAppLoaded();
  const themeBus = useThemeInjectFromBus();
  const { status, result, dataURL, update } = useLoginQRCode();
  const mainWindow = useListenable(RendererWindow.get("main"));
  const currentWindow = useListenable(RendererWindow.current);

  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && result) {
      mainWindow.send("message_dispatch_login", result.cookie);
      queueMicrotask(() => currentWindow.close());
    }
  }, [currentWindow, mainWindow, result, status]);

  return (
    <div className="w-screen h-screen overflow-hidden">
      <div className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          fluid
          fluidSpeed={5}
          className="absolute inset-0"
          src={themeBus.data?.backgroundCover}
          opacity={0.7}
          brightness={0.5}
          blur={30}
        />
      </div>
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
