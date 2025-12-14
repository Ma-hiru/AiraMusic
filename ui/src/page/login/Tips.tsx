import { FC, memo } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { QRCodeStatus } from "@mahiru/ui/hook/useLoginQRCode";

interface TipsProps {
  status: QRCodeStatus;
  result: Nullable<NeteaseLoginQrCheckResponse>;
}

const Tips: FC<TipsProps> = ({ status, result }) => {
  const cachedAvatar = useFileCache(Filter.NeteaseImageSize(result?.avatarUrl, ImageSize.sm));
  return (
    <div className="flex justify-center items-center flex-col">
      {status !== QRCodeStatus.WAITING_CONFIRM && (
        <div className="flex justify-center items-center flex-col">
          <img src="/netease-music.png" alt="netease" className="size-10" />
          <span className="font-bold mt-4">登录网易云音乐</span>
          <span className="text-xs text-gray-600/50 mt-1">{mapQRCodeStatusToText(status)}</span>
        </div>
      )}
      {status === QRCodeStatus.WAITING_CONFIRM && (
        <div className="flex justify-center items-center flex-col">
          <img src={cachedAvatar} alt="avatar" className="size-10 rounded-full" />
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
