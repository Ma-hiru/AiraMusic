import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { css, cx } from "@emotion/css";
import ControlButton from "@mahiru/ui/page/layout/componets/ControlButton";
import { loginQrCodeCheck, loginQrCodeCreate, loginQrCodeKey } from "@mahiru/ui/api/auth";
import QRCode from "qrcode";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

const LoginPage: FC<object> = () => {
  const [codeURL, setCodeURL] = useState<Nullable<string>>(null);
  const [codeKey, setCodeKey] = useState("");
  const [effect, setEffect] = useState(false);
  const [status, setStatus] = useState("无二维码");
  const timer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
  const genCode = useCallback(async () => {
    const keyResult = await loginQrCodeKey();
    setCodeKey(keyResult.data.unikey);
    const codeResult = await loginQrCodeCreate({ key: keyResult.data.unikey });
    const url = await genCodeBase64(codeResult.data.qrurl);
    setCodeURL(url);
    setEffect(true);
  }, []);
  useEffect(() => {
    if (effect && timer.current === null) {
      timer.current = setTimeout(async function checkCode() {
        try {
          const checkResult = await loginQrCodeCheck(codeKey);
          if (checkResult.code === 803) {
            setStatus("授权成功");
            window.node.event.loggedInSuccess(checkResult.cookie!);
            window.node.event.close("login");
            setEffect(false);
            clearTimeout(timer.current as ReturnType<typeof setTimeout>);
            timer.current = null;
            return;
          } else if (checkResult.code === 800) {
            setEffect(false);
            setStatus("二维码已失效");
            clearTimeout(timer.current as ReturnType<typeof setTimeout>);
            timer.current = null;
            return;
          } else if (checkResult.code === 801) {
            setStatus("等待扫码");
          } else if (checkResult.code === 802) {
            setStatus("等待授权");
          }
        } catch (err) {
          Log.error(
            new EqError({
              label: "ui/LoginPage.ts:checkCode",
              message: "Failed to check QR code status",
              raw: err
            })
          );
        }
        timer.current = setTimeout(checkCode, 2000);
      }, 2000);
    }
  }, [effect, codeKey]);
  return (
    <div className="w-screen h-screen overflow-hidden p-4">
      <div
        className={cx(
          "h-6 flex items-center justify-end",
          css`
            -webkit-app-region: drag;
          `
        )}>
        <ControlButton windowId={"login"} maximizable={false} />
      </div>
      <button
        className="bg-purple-500 px-2 py-1 rounded-md text-white"
        onClick={() => {
          window.node.event.close("login");
        }}>
        close
      </button>
      <button className="bg-purple-500 px-2 py-1 rounded-md text-white" onClick={genCode}>
        get qr
      </button>
      {status}
      <img src={codeURL as string} alt="" />
    </div>
  );
};
export default memo(LoginPage);

async function genCodeBase64(url: string) {
  try {
    return await QRCode.toDataURL(url, {
      width: 300,
      margin: 2
    });
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/LoginPage.ts:genCodeBase64",
        message: "Failed to generate QR code",
        raw: err
      })
    );
    return null;
  }
}
