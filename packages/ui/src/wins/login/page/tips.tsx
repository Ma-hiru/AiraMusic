import { memo, type FC, useMemo } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { QRCodeStatus } from "@/wins/login/hooks/use-login-qr-code";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TipsProps {
  status: QRCodeStatus;
  loginType: "qr" | "captcha";
  result: Nullable<NeteaseAPI.NeteaseLoginQrCheckResponse>;
}

const Tips: FC<TipsProps> = ({ result, status, loginType }) => {
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(result?.avatarUrl)
        ?.setSize(NeteaseImageSize.sm)
        ?.setAlt(result?.nickname),
    [result?.avatarUrl, result?.nickname]
  );
  // 仅扫码登录在待确认时展示用户头像
  const waitingConfirm = loginType === "qr" && status === QRCodeStatus.WAITING_CONFIRM;
  return (
    <div className="flex justify-center items-center flex-col">
      {!waitingConfirm && (
        <div className="flex justify-center items-center flex-col">
          <img className="size-10" alt="netease-music" src="/images/netease-music.png" />
          <span className="font-bold mt-4">登录网易云音乐</span>
          <span className="text-xs mt-1 opacity-80">
            {loginType === "captcha" ? "短信验证码登录" : mapQRCodeStatusToText(status)}
          </span>
        </div>
      )}
      {waitingConfirm && (
        <div className="flex justify-center items-center flex-col">
          <NeteaseImage
            className="size-10 rounded-full"
            cache={false}
            image={image}
            shadowColor={"light"}
          />
          <span className="font-bold mt-4">{result?.nickname}</span>
        </div>
      )}
    </div>
  );
};
export default memo(Tips);

function mapQRCodeStatusToText(status: QRCodeStatus) {
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
