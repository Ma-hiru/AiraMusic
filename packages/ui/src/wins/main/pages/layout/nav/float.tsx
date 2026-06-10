import { type FC, memo, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@emotion/css";
import { ArrowUp, SearchIcon } from "lucide-react";
import { useSetAtom } from "jotai";
import { typingAtom } from "@/wins/main/atoms/layout";
import { AnimatePresence, motion } from "motion/react";
import { debounce } from "lodash-es";

import FloatItem from "@/wins/main/pages/layout/float/float-item";

interface NavFloatProps {
  setKeyword: NormalFunc<[keyword: string]>;
  sideBar: boolean;
  canScroll: boolean;

  onScrollTop?: NormalFunc;
}

const NavFloat: FC<NavFloatProps> = ({ setKeyword, sideBar, canScroll, onScrollTop }) => {
  const setTyping = useSetAtom(typingAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const debouncedSearch = useMemo(() => debounce(setKeyword, 300), [setKeyword]);

  const [showFloat, setShowFloat] = useState(false);
  const [hoverFloat, setHoverFloat] = useState(false);

  useEffect(() => {
    (sideBar || hoverFloat || showInput) && setShowFloat(true);
  }, [hoverFloat, showInput, sideBar]);

  useEffect(() => {
    if (showFloat && sideBar && !hoverFloat && !showInput) {
      const timer = window.setTimeout(() => setShowFloat(false), 2000);
      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [hoverFloat, showInput, showFloat, sideBar]);

  return (
    <section
      onMouseOver={() => setHoverFloat(true)}
      onMouseLeave={() => setHoverFloat(false)}
      className={cx(
        `
        min-w-10 min-h-15 absolute right-2 bottom-20
        flex flex-col gap-2 justify-end items-end
      `
      )}>
      <AnimatePresence>
        {showFloat && canScroll && (
          <FloatItem key="scroll-top" onClick={onScrollTop}>
            <ArrowUp className="size-5" />
          </FloatItem>
        )}
        {showFloat && (
          <motion.div
            key="search"
            exit={{ opacity: 0, scale: 0 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ease: "easeInOut", duration: 0.3 }}
            className={cx(
              `
                cursor-pointer backdrop-blur-sm rounded-full p-1
                flex items-center justify-center text-(--theme-color-main)
                bg-(--text-color-on-main)/60
            `
            )}>
            <div
              className={cx(
                "relative size-5 ease-in-out duration-300 transition-all flex justify-center items-center pr-5 overflow-hidden contain-strict",
                showInput && "w-30! px-1"
              )}>
              <input
                value={value}
                ref={inputRef}
                className={cx(
                  `
                  w-full h-full outline-none text-sm
                  duration-300 ease-in-out transition-all
                `
                )}
                onChange={(e) => {
                  setValue(e.target.value);
                  debouncedSearch(e.target.value.trim());
                }}
                onFocus={() => setTyping(true)}
                onBlur={() => {
                  setShowInput(false);
                  setTyping(false);
                }}
                type="text"
              />
              <SearchIcon
                onClick={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                  setShowInput(true);
                }}
                className={cx(
                  `
                  size-5 scale-95 absolute right-0 top-1/2
                  -translate-y-1/2 z-10 hover:opacity-60
                  `
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default memo(NavFloat);
