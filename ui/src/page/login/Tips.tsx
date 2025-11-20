import { FC, memo, useEffect, useState } from "react";
import { mapQRCodeStatusToText, QRCodeStatus } from "@mahiru/ui/hook/useQRCode";
import { NeteaseLoginQrCheckResponse } from "@mahiru/ui/types/netease-api";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

interface TipsProps {
  status: QRCodeStatus;
  result: Nullable<NeteaseLoginQrCheckResponse>;
}

const Tips: FC<TipsProps> = ({ status, result }) => {
  const [avatar, setAvatar] = useState<Nullable<string>>(null);
  useEffect(() => {
    result?.avatarUrl && setAvatar(wrapCacheUrl(result.avatarUrl));
  }, [result?.avatarUrl]);
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
          <img src={avatar as string} alt="avatar" className="size-10 rounded-full" />
          <span className="font-bold mt-4">{result?.nickname}</span>
        </div>
      )}
    </div>
  );
};
export default memo(Tips);
