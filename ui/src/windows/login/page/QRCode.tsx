import { cx } from "@emotion/css";
import { RotateCcw } from "lucide-react";
import { FC, memo, useEffect, useState } from "react";
import { QRCodeStatus } from "@mahiru/ui/windows/login/hooks/useLoginQRCode";

interface QRCodeProps {
  url: Nullable<string>;
  status: QRCodeStatus;
  update: () => void;
}

const QRCode: FC<QRCodeProps> = ({ url, status, update }) => {
  const [showUpdateMask, setShowUpdateMask] = useState(false);

  useEffect(() => {
    if (status === QRCodeStatus.EXPIRED) {
      setShowUpdateMask(true);
    }
  }, [status]);

  return (
    <div className="flex justify-center flex-col items-center gap-1">
      <div
        className="relative overflow-hidden rounded-md bg-black/60"
        onMouseEnter={() => setShowUpdateMask(true)}>
        <div className="size-40">
          {url && <img src={url} alt="QRCode" className="w-full h-full" />}
        </div>
        <div
          onMouseLeave={() => status !== QRCodeStatus.EXPIRED && setShowUpdateMask(false)}
          className={cx(
            "absolute inset-0 bg-black/60 flex justify-center items-center",
            "ease-in-out transition-opacity duration-300",
            showUpdateMask ? "opacity-100" : "opacity-0"
          )}>
          <button
            className="flex gap-1 text-sm justify-center items-center text-white cursor-pointer hover:text-white/80 active:scale-95 p-1"
            onClick={update}>
            <RotateCcw className="size-4" />
            <span>刷新</span>
          </button>
        </div>
      </div>
      <span className="text-sm font-medium">打开网易云音乐APP扫码登录</span>
    </div>
  );
};
export default memo(QRCode);
