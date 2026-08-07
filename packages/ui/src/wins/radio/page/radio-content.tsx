import { memo, type FC } from "react";
import RadioMeta from "@/wins/radio/page/radio-meta";
import RadioLyric from "@/wins/radio/page/radio-lyric";
import RadioComment from "@/wins/radio/page/radio-comment";

const RadioContent: FC = () => {
  return (
    <main className="flex h-full w-full px-3 contain-strict">
      <RadioMeta className="h-full shrink-0 w-[30%]!" />
      <RadioLyric className="h-[95%] my-auto shrink-0 w-[40%]!" />
      <RadioComment className="h-[95%] my-auto shrink-0 w-[30%]!" />
    </main>
  );
};

export default memo(RadioContent);
