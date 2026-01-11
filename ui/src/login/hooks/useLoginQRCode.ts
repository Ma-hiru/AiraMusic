import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { API } from "@mahiru/ui/public/api";

interface LoginQRCodeProps {
  qrOptions?: QRCode.QRCodeToDataURLOptions;
  checkInterval?: number;
}

export function useLoginQRCode(props?: LoginQRCodeProps) {
  const { qrOptions, checkInterval = 3000 } = props || {};
  const [status, setStatus] = useState(QRCodeStatus.INITIALIZED);
  const [dataURL, setDataURL] = useState<Nullable<string>>(null);
  const [result, setResult] = useState<Nullable<NeteaseLoginQrCheckResponse>>(null);
  const [key, setKey] = useState("");

  // 请求并生成二维码
  const fetchQRCode = useCallback(async () => {
    try {
      const { QRCodeKey, QRCodeURL } = await requestQRCode();
      const QRDataURL = await genCodeDataURL(QRCodeURL, {
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
          label: "hook/useQRCode.ts",
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
    if (status === QRCodeStatus.INITIALIZED) {
      void fetchQRCode();
    }
  }, [fetchQRCode, status]);
  // 定时检查二维码状态
  useEffect(() => {
    if (key) {
      const timer = setInterval(() => {
        checkQRCode(key).then((check) => {
          setStatus(check.code);
          setResult(check.result);
          if (
            check.code === QRCodeStatus.EXPIRED ||
            check.code === QRCodeStatus.AUTHORIZED ||
            check.code === QRCodeStatus.ERROR
          ) {
            clearInterval(timer);
          }
        });
      }, checkInterval);
      return () => clearInterval(timer);
    }
  }, [checkInterval, key]);

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

async function requestQRCode() {
  const keyResult = await API.Auth.loginQrCodeKey();
  const codeResult = await API.Auth.loginQrCodeCreate({ key: keyResult.data.unikey });
  return {
    QRCodeKey: keyResult.data.unikey,
    QRCodeURL: codeResult.data.qrurl
  };
}

async function checkQRCode(codeKey: string) {
  try {
    const checkResult = await API.Auth.loginQrCodeCheck(codeKey);
    return { code: checkResult.code as QRCodeStatus, result: checkResult };
  } catch (err) {
    Log.error(
      new EqError({
        label: "LoginPage.tsx:checkCode",
        message: "failed to check QR code status",
        raw: err
      })
    );
    return { code: QRCodeStatus.ERROR, result: null };
  }
}

async function genCodeDataURL(url: string, options: QRCode.QRCodeToDataURLOptions) {
  try {
    return await QRCode.toDataURL(url, options);
  } catch (err) {
    Log.error(
      new EqError({
        label: "LoginPage.tsx:genCodeDataURL",
        message: "failed to generate QR code",
        raw: err
      })
    );
    return null;
  }
}
