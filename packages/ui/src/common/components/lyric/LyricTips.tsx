import { FC, memo } from "react";
import { cx } from "@emotion/css";

type LyricTipsProps = {
  tips: Optional<string>;
  crossAlign?: "left" | "center" | "right";
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
