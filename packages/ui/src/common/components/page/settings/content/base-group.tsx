import { type FC, memo, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cx } from "@emotion/css";

interface BaseGroupProps {
  items: ReactNode[];
  expand: boolean;
}

const BaseGroup: FC<BaseGroupProps> = ({ items, expand }) => {
  const containerRef = useRef(null);
  const [itemHeight, setItemHeight] = useState<Nullable<number>>(null);
  const firstChildRef = useRef<HTMLDivElement>(null);
  const first = items[0];

  useLayoutEffect(() => {
    const firstChild = firstChildRef.current;
    if (!firstChild) return setItemHeight(0);
    setItemHeight(firstChild.offsetHeight * (expand ? items.length : 1));
  }, [expand, items.length, first]);

  return (
    <section
      ref={containerRef}
      className="ease-in-out duration-500 transition-all overflow-hidden"
      style={{
        height: itemHeight === null ? "fit-content" : itemHeight + "px"
      }}>
      {items.map((item, index) => (
        <div
          ref={index === 0 ? firstChildRef : undefined}
          className={cx(
            "ease-in-out duration-500 transition-all",
            !expand && index !== 0 && "opacity-0"
          )}
          key={index}>
          {item}
        </div>
      ))}
    </section>
  );
};

export default memo(BaseGroup);
