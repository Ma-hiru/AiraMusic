import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useEffect } from "react";
import Marquee from "@/common/components/display/marquee";
import RendererPlayerHandle from "@/wins/main/lib/handle";

interface TitleProps {
  className?: string;
}

const Title: FC<TitleProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track?.detail;
  const ts = track?.translate;
  const alias = track?.aliaName;
  const title = track?.splitTitle?.();

  const subTitle = useMemo(() => {
    if (!title?.sub) return null;
    return (
      <Marquee
        className="opacity-50 text-[65%] leading-normal"
        text={title.sub}
        options={{
          speed: 15,
          pingPong: true,
          pauseOnHover: true,
          gapDuration: 2000
        }}
      />
    );
  }, [title?.sub]);

  const aliasTitle = useMemo(() => {
    if (!alias) return null;
    return (
      <Marquee
        className="opacity-50 text-[65%] leading-normal"
        text={alias}
        options={{
          speed: 15,
          pingPong: true,
          pauseOnHover: true,
          gapDuration: 2000
        }}
      />
    );
  }, [alias]);

  useEffect(() => {}, []);

  const subTitleLonger = (title?.sub ?? "").length > (alias || "").length;

  return (
    <section className={cx("flex flex-col justify-end text-center contain-layout", className)}>
      <Marquee
        className="opacity-50 text-[70%] leading-normal"
        text={ts}
        options={{
          speed: 15,
          pingPong: true,
          pauseOnHover: true,
          gapDuration: 2000
        }}
      />
      <Marquee
        className="font-bold leading-normal"
        text={title?.main}
        options={{
          speed: 10,
          pingPong: true,
          pauseOnHover: true,
          gapDuration: 2000
        }}
      />
      {subTitleLonger ? (
        <>
          {aliasTitle}
          {subTitle}
        </>
      ) : (
        <>
          {subTitle}
          {aliasTitle}
        </>
      )}
    </section>
  );
};

export default memo(Title);
