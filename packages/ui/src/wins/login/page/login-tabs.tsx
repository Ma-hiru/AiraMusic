import { cx } from "@emotion/css";
import { type FC, memo } from "react";

interface LoginTabsProps {
  tabs: string[];
  activeIndex: number;
  onChange: NormalFunc<[index: number]>;
}

const LoginTabs: FC<LoginTabsProps> = ({ tabs, activeIndex, onChange }) => {
  return (
    <div className="flex items-center gap-7 text-[13px] font-semibold">
      {tabs.map((label, index) => {
        const active = activeIndex === index;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(index)}
            className={cx(
              "relative cursor-pointer pb-1 ease-in-out transition-colors duration-300",
              active ? "text-(--text-color)" : "text-(--text-color)/45 hover:text-(--text-color)/70"
            )}>
            {label}
            <span
              className={cx(
                `
                  absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full
                  bg-primary ease-in-out transition-all duration-300
                `,
                active ? "w-5 opacity-100" : "w-0 opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

export default memo(LoginTabs);
