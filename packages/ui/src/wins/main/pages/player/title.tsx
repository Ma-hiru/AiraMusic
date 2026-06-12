import { type FC, memo } from "react";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import { cx } from "@emotion/css";

interface TitleProps {
  className?: string;
}

const Title: FC<TitleProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track?.detail;
  const ts = track?.translate;
  const alias = track?.aliaName;
  const title = track?.splitTitle?.();
  return (
    <section className={cx("flex flex-col justify-end text-center", className)}>
      <h1 className="font-bold line-clamp-1" children={title?.main} />
      <h2
        className={cx("opacity-50 line-clamp-1 text-[80%]", !(ts || alias) && "hidden")}
        children={ts || alias}
      />
      <h3
        className={cx("opacity-50 line-clamp-1 text-[70%]", !title?.sub && "hidden")}
        children={title?.sub}
      />
    </section>
  );
};

export default memo(Title);
