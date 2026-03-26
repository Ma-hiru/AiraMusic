import AppWindow from "@mahiru/ui/public/entry/window";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import { useEffect } from "react";
import { QRCodeStatus, useLoginQRCode } from "@mahiru/ui/login/hooks/useLoginQRCode";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";

import QRCode from "./QRCode";
import Tips from "./Tips";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import TopControlPure from "@mahiru/ui/public/components/public/TopControlPure";

export default function LoginPage() {
  const { status, result, dataURL, update } = useLoginQRCode();
  const mainWindow = useListenableHook(AppWindow.from("main"));
  const currentWindow = useListenableHook(AppWindow.current);

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
