import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import RadioMeta from "@/wins/radio/page/radio-meta";
import RadioLyric from "@/wins/radio/page/radio-lyric";
import RadioComment from "@/wins/radio/page/radio-comment";

interface RadioContentProps {
  openComment?: boolean;
}

const RadioContent: FC<RadioContentProps> = ({ openComment = true }) => {
  return (
    <main className="flex h-full w-full contain-strict">
      <RadioMeta className={cx("h-full shrink-0 w-[30%]!", !openComment && "w-[45%]!")} />
      <RadioLyric
        className={cx(
          "h-[95%] my-auto shrink-0 w-[38%]! mr-[2%]",
          !openComment && "mr-0! w-[55%]!"
        )}
      />
      {openComment && <span className="h-[80%] w-px border my-auto opacity-10" />}
      <RadioComment
        className={cx(
          "h-[95%] my-auto shrink-0 w-[30%]!",
          !openComment && "absolute -right-[30%] invisible"
        )}
      />
    </main>
  );
};

export default memo(RadioContent);
