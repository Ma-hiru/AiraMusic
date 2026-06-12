import { type FC, memo, useRef } from "react";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import { cx } from "@emotion/css";
import { useMarquee } from "@/common/hooks/use-marquee";

interface TitleProps {
  className?: string;
}

const Title: FC<TitleProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track?.detail;
  const ts = track?.translate;
  const alias = track?.aliaName;
  const title = track?.splitTitle?.();
  const mainTitleRef = useRef<HTMLHeadingElement>(null);
  const subTitleRef = useRef(null);
  useMarquee(mainTitleRef, {
    speed: 20,
    pingPong: true,
    pauseOnHover: true,
    gapDuration: 2000
  });
  useMarquee(subTitleRef, {
    speed: 20,
    pingPong: true,
    pauseOnHover: true,
    gapDuration: 2000
  });

  return (
    <section className={cx("flex flex-col justify-end text-center", className)}>
      <h1
        ref={mainTitleRef}
        className="font-bold truncate max-w-full overflow-hidden"
        children={<span className="inline-block">{title?.main}</span>}
      />
      <h2
        ref={subTitleRef}
        className={cx(
          "opacity-50 text-[75%] overflow-hidden max-w-full truncate",
          !title?.sub && "hidden"
        )}
        children={<span className="inline-block">{title?.sub}</span>}
      />
      <h3
        className={cx("opacity-50 line-clamp-1 text-[70%]", !(ts || alias) && "hidden")}
        children={ts || alias}
      />
    </section>
  );
};

export default memo(Title);
