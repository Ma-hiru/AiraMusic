import { FC, memo } from "react";
import { mapQRCodeStatusToText, QRCodeStatus } from "@mahiru/ui/hook/useQRCode";
import { NeteaseLoginQrCheckResponse } from "@mahiru/ui/types/netease-api";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";

interface TipsProps {
  status: QRCodeStatus;
  result: Nullable<NeteaseLoginQrCheckResponse>;
}

const Tips: FC<TipsProps> = ({ status, result }) => {
  const cachedAvatar = useFileCache(setImageURLSize(result?.avatarUrl, "md"));
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
