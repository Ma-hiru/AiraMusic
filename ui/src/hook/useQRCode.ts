import QRCode from "qrcode";
import { Log, EqError } from "@mahiru/ui/utils/dev";
import { useCallback, useEffect, useRef, useState } from "react";
import { loginQrCodeCheck, loginQrCodeCreate, loginQrCodeKey } from "@mahiru/ui/api/auth";

export enum QRCodeStatus {
  WAITING_SCAN = 801,
  WAITING_CONFIRM = 802,
  AUTHORIZED = 803,
  EXPIRED = 800,
  ERROR = 400,
  INITIALIZED = 0
}

export function mapQRCodeStatusToText(status: QRCodeStatus) {
  switch (status) {
    case QRCodeStatus.WAITING_SCAN:
      return "等待扫描";
    case QRCodeStatus.WAITING_CONFIRM:
      return "等待确认";
    case QRCodeStatus.AUTHORIZED:
      return "已授权";
    case QRCodeStatus.EXPIRED:
      return "二维码已过期";
    case QRCodeStatus.ERROR:
      return "登录出错";
    case QRCodeStatus.INITIALIZED:
      return "初始化";
    default:
      return "未知状态";
  }
}

export function useQRCode() {
  const [status, setStatus] = useState(QRCodeStatus.INITIALIZED);
  const [dataURL, setDataURL] = useState<Nullable<string>>(null);
  const key = useRef("");
  const [result, setResult] = useState<Nullable<NeteaseLoginQrCheckResponse>>(null);
  const timer = useRef<Nullable<ReturnType<typeof setInterval>>>(null);

  const setCheckTimer = useCallback(() => {
    timer.current && clearInterval(timer.current);
    timer.current = setInterval(() => {
      key.current &&
        checkQRCode(key.current).then(({ code, result }) => {
          setStatus(code);
          setResult(result);
          if (
            code === QRCodeStatus.EXPIRED ||
            code === QRCodeStatus.AUTHORIZED ||
            code === QRCodeStatus.ERROR
          ) {
            timer.current && clearInterval(timer.current);
          }
        });
    }, 1200);
  }, [key]);

  const fetchQRCode = useCallback(async () => {
    try {
      const { QRCodeKey, QRCodeURL } = await requestQRCode();
      const QRDataURL = await genCodeDataURL(QRCodeURL, {
        width: 200,
        margin: 2,
        color: {
          dark: "#8a060b",
          light: "#ffffff"
        }
      });
      setDataURL(QRDataURL);
      key.current = QRCodeKey;
      setStatus(QRCodeStatus.WAITING_SCAN);
      setCheckTimer();
    } catch (err) {
      Log.error(
        new EqError({
          label: "ui/useQRCode.ts",
          message: "Failed to request QR code",
          raw: err
        })
      );
      setStatus(QRCodeStatus.ERROR);
    }
  }, [setCheckTimer]);

  useEffect(() => {
    if (status === QRCodeStatus.INITIALIZED) {
      fetchQRCode().then();
    }
  }, [fetchQRCode, status]);

  const update = useCallback(() => {
    setStatus(QRCodeStatus.INITIALIZED);
    key.current = "";
    timer.current && clearInterval(timer.current);
    timer.current = null;
  }, []);

  return { status, dataURL, result, update };
}

async function requestQRCode() {
  const keyResult = await loginQrCodeKey();
  const codeResult = await loginQrCodeCreate({ key: keyResult.data.unikey });
  return {
    QRCodeKey: keyResult.data.unikey,
    QRCodeURL: codeResult.data.qrurl
  };
}

async function checkQRCode(codeKey: string) {
  try {
    const checkResult = await loginQrCodeCheck(codeKey);
    return { code: checkResult.code as QRCodeStatus, result: checkResult };
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/LoginPage.ts:checkCode",
        message: "Failed to check QR code status",
        raw: err
      })
    );
    return { code: QRCodeStatus.ERROR, result: null };
  }
}

export async function genCodeDataURL(url: string, options: QRCode.QRCodeToDataURLOptions) {
  try {
    return await QRCode.toDataURL(url, options);
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
