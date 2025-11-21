import { FC, memo, useEffect, useState } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";

const Cover: FC<object> = () => {
  const { info } = usePlayer();
  const [cacheCover, setCacheCover] = useState<Nullable<string>>(null);
  useEffect(() => {
    setCacheCover(wrapCacheUrl(setImageURLSize(info.cover, "raw")));
  }, [info.cover]);
  return (
    <img
      className="sm:w-[200px] lg:w-[300px] object-cover rounded-lg shadow-lg ease-in duration-300 transition-normal pointer-events-none"
      src={(cacheCover || null) as string}
      alt={info.album?.name || info.title}
    />
  );
};
export default memo(Cover);
