import { useState, useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import { useListenable } from "@/common/hooks/use-listenable";
import { useLoginCaptcha } from "@/wins/login/hooks/use-login-captcha";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { QRCodeStatus, useLoginQRCode } from "@/wins/login/hooks/use-login-qr-code";
import Drag from "@/common/components/layout/drag/drag";
import AppToast from "@/common/components/display/toast";
import NoDrag from "@/common/components/layout/drag/no-drag";
import Control from "@/common/components/layout/top/control";
import AcrylicBackground from "@/common/components/display/acrylic-background";

import Tips from "./tips";
import QRCode from "./qr-code";
import LoginTabs from "./login-tabs";
import PhoneCaptcha from "./phone-captcha";

const LOGIN_TABS = ["扫码登录", "验证码登录"];

export default function LoginPage() {
  useAppLoaded();
  const themeBus = useThemeInjectFromBus();
  const [tab, setTab] = useState(0); // 0: 扫码登录 1: 验证码登录
  const { result, status, update, dataURL } = useLoginQRCode();
  const captcha = useLoginCaptcha();
  const mainWindow = useListenable(RendererWindow.get("main"));
  const currentWindow = useListenable(RendererWindow.current);

  const dispatchLogin = useCallback(
    (cookie: string) => {
      mainWindow.send("message_dispatch_login", cookie);
      queueMicrotask(() => currentWindow.close());
    },
    [currentWindow, mainWindow]
  );

  // 扫码登录成功
  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && result?.cookie) dispatchLogin(result.cookie);
  }, [dispatchLogin, result, status]);

  // 验证码登录成功
  useEffect(() => {
    if (captcha.cookie) dispatchLogin(captcha.cookie);
  }, [captcha.cookie, dispatchLogin]);

  return (
    <div className="w-screen h-screen overflow-hidden">
      <div className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          className="absolute inset-0"
          blur={30}
          opacity={0.7}
          fluidSpeed={5}
          brightness={0.5}
          src={themeBus.data?.backgroundCover}
          fluid
        />
      </div>
      <Drag className="w-screen h-6 flex items-center justify-end absolute top-0 left-0 right-0 p-6 px-5">
        <Control mini />
      </Drag>
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-10">
        <NoDrag className="shrink-0">
          <LoginTabs activeIndex={tab} tabs={LOGIN_TABS} onChange={setTab} />
        </NoDrag>
        <div className="flex-1 flex items-center justify-center gap-8">
          <Tips result={result} status={status} loginType={tab === 0 ? "qr" : "captcha"} />
          <div className="w-px shrink-0 bg-(--text-color)/15" />
          <div className="w-52 shrink-0 flex flex-col justify-center">
            {tab === 0 ? (
              <QRCode url={dataURL} status={status} update={update} />
            ) : (
              <PhoneCaptcha
                phone={captcha.phone}
                captcha={captcha.captcha}
                logging={captcha.logging}
                sending={captcha.sending}
                countdown={captcha.countdown}
                onLogin={captcha.login}
                onPhoneChange={captcha.setPhone}
                onSendCaptcha={captcha.sendCaptcha}
                onCaptchaChange={captcha.setCaptcha}
              />
            )}
          </div>
        </div>
      </div>
      <AppToast.Provider />
    </div>
  );
}
