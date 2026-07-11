import { cx } from "@emotion/css";
import { memo, type FC } from "react";

type LyricTipsProps = {
  tips: Optional<string>;
  crossAlign?: "left" | "right" | "center";
};

const LyricTips: FC<LyricTipsProps> = ({ tips, crossAlign }) => {
  if (!tips) return null;
  return (
    <div
      className={cx(
        `
            w-full px-4 py-1 rounded-md hover:blur-none hover:bg-white/20
          text-white/80 truncate font-semibold text-lg
          `,
        crossAlign === "left" && "text-left",
        crossAlign === "center" && "text-center",
        crossAlign === "right" && "text-right"
      )}>
      {tips}
    </div>
  );
};

export default memo(LyricTips);
