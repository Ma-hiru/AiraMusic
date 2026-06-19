import { type FC, memo, useEffect, useMemo } from "react";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import { cx } from "@emotion/css";
import Marquee from "@/common/components/display/marquee";

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

  const tsTitle = useMemo(() => {
    if (!ts) return null;
    return (
      <Marquee
        className="opacity-50 text-[65%] leading-normal -mb-1"
        text={ts}
        options={{
          speed: 15,
          pingPong: true,
          pauseOnHover: true,
          gapDuration: 2000
        }}
      />
    );
  }, [ts]);

  useEffect(() => {}, []);

  const subTitleLonger = (title?.sub ?? "").length > (ts || alias || "").length;

  return (
    <section className={cx("flex flex-col justify-end text-center contain-layout", className)}>
      {tsTitle}
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
