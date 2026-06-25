import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { type HomeChannelKey, NavConstants } from "@/wins/main/constants";

interface HomeChannelTabsProps {
  active: HomeChannelKey;
  onChange: NormalFunc<[key: HomeChannelKey]>;
  className?: string;
  sticky?: boolean;
}

const HomeChannelTabs: FC<HomeChannelTabsProps> = ({
  active,
  onChange,
  className,
  sticky = true
}) => {
  return (
    <section
      className={cx(
        "flex w-full mt-2 gap-2 z-30  rounded-full justify-center ",
        sticky && "sticky top-2",
        className
      )}>
      {NavConstants.HOME_CHANNELS.map(({ key, label, caption, Icon }) => {
        const selected = key === active;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cx(
              `
                flex min-w-36 py-1 shrink-0 cursor-pointer items-center gap-3 rounded-lg
                border border-white/20 px-3 text-left backdrop-saturate-150 backdrop-blur-lg
                shadow-md transition-all duration-300 ease-in-out
                active:scale-[0.98]
              `,
              selected
                ? "bg-primary text-primary-text hover:bg-primary-active"
                : "bg-white/5 hover:bg-white/20"
            )}>
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{label}</span>
              <span className="block truncate text-[10px] font-bold uppercase opacity-50">
                {caption}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
};

export default memo(HomeChannelTabs);
