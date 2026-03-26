import QRCode from "qrcode";
import NCM_API from "@mahiru/ui/public/api";
import { useCallback, useEffect, useState } from "react";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";

interface LoginQRCodeProps {
  qrOptions?: QRCode.QRCodeToDataURLOptions;
  checkInterval?: number;
}

export function useLoginQRCode(props?: LoginQRCodeProps) {
  const { qrOptions, checkInterval = 3000 } = props || {};
  const [status, setStatus] = useState(QRCodeStatus.INITIALIZED);
  const [dataURL, setDataURL] = useState<Nullable<string>>(null);
  const [result, setResult] = useState<Nullable<NeteaseAPI.NeteaseLoginQrCheckResponse>>(null);
  const [key, setKey] = useState("");

  // 请求并生成二维码
  const fetchQRCode = useCallback(async () => {
    try {
      const { QRCodeKey, QRDataURL } = await requestQRCode({
        width: 200,
        margin: 2,
        color: {
          dark: "#8a060b",
          light: "#ffffff"
        },
        ...qrOptions
      });
      setDataURL(QRDataURL);
      setKey(QRCodeKey);
      setStatus(QRCodeStatus.WAITING_SCAN);
    } catch (err) {
      Log.error(
        new EqError({
          label: "useQRCode",
          message: "failed to request QR code",
          raw: err
        })
      );
      setStatus(QRCodeStatus.ERROR);
    }
  }, [qrOptions]);
  // 重置二维码状态
  const update = useCallback(() => {
    setStatus(QRCodeStatus.INITIALIZED);
    setKey("");
  }, []);
  // 初始化时获取二维码
  useEffect(() => {
    status === QRCodeStatus.INITIALIZED && fetchQRCode();
  }, [fetchQRCode, status]);
  // 定时检查二维码状态
  useEffect(() => {
    if (key) {
      const timer = setInterval(() => {
        checkQRCode(key)
          .then((check) => {
            setStatus(check.code);
            setResult(check.result);
            if (
              check.code === QRCodeStatus.EXPIRED ||
              check.code === QRCodeStatus.AUTHORIZED ||
              check.code === QRCodeStatus.ERROR
            ) {
              clearInterval(timer);
            }
          })
          .catch((err) => {
            Log.error(
              new EqError({
                label: "useQRCode",
                message: "failed to check QR code",
                raw: err
              })
            );
            setStatus(QRCodeStatus.ERROR);
            setResult(null);
            clearInterval(timer);
          });
      }, checkInterval);
      return () => clearInterval(timer);
    }
  }, [checkInterval, key]);
  // 结果错误时设置Error状态
  useEffect(() => {
    if (status === QRCodeStatus.AUTHORIZED && !result?.cookie) {
      setStatus(QRCodeStatus.ERROR);
    }
  }, [result?.cookie, status]);

  return {
    status,
    dataURL,
    result,
    update
  };
}

export enum QRCodeStatus {
  WAITING_SCAN = 801,
  WAITING_CONFIRM = 802,
  AUTHORIZED = 803,
  EXPIRED = 800,
  ERROR = 400,
  INITIALIZED = 0
}

async function requestQRCode(options: QRCode.QRCodeToDataURLOptions) {
  const keyResult = await NCM_API.Auth.loginQrCodeKey();
  const codeResult = await NCM_API.Auth.loginQrCodeCreate({ key: keyResult.data.unikey });
  const codeDataURL = await QRCode.toDataURL(codeResult.data.qrurl, options);
  return {
    QRCodeKey: keyResult.data.unikey,
    QRDataURL: codeDataURL
  };
}

async function checkQRCode(codeKey: string) {
  const checkResult = await NCM_API.Auth.loginQrCodeCheck(codeKey);
  return { code: checkResult.code as QRCodeStatus, result: checkResult };
}
