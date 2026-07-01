import { cx } from "@emotion/css";
import { useSetAtom } from "jotai";
import { debounce } from "lodash-es";
import { motion, AnimatePresence } from "motion/react";
import { Plus, ArrowUp, SearchIcon } from "lucide-react";
import { memo, useRef, type FC, useMemo, useState, useEffect } from "react";
import { useUser } from "@/common/store/user";
import { typingAtom } from "@/wins/main/atoms/layout";
import AppModal from "@/common/components/display/modal";
import FloatItem from "@/common/components/layout/float/float-item";

interface NavFloatProps {
  sideBar: boolean;
  canScroll: boolean;
  setKeyword: NormalFunc<[keyword: string]>;
  onScrollTop?: NormalFunc;
  onCreated?: NormalFunc<[playlist: NeteaseAPI.NeteasePlaylistSummary]>;
}

const NavFloat: FC<NavFloatProps> = ({
  canScroll,
  setKeyword,
  onCreated,
  onScrollTop,
  sideBar
}) => {
  const user = useUser();
  const setTyping = useSetAtom(typingAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const { create, createPlaylistCreateModal } = AppModal.useModal();
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
      className={cx(
        `
        min-w-10 min-h-15 absolute right-2 bottom-20
        flex flex-col gap-2 justify-end items-end
      `,
        !sideBar && "pointer-events-none"
      )}
      onMouseOver={() => sideBar && setHoverFloat(true)}
      onMouseLeave={() => sideBar && setHoverFloat(false)}>
      <AnimatePresence>
        {showFloat && canScroll && sideBar && (
          <FloatItem key="scroll-top" motionKey="scroll-top" onClick={onScrollTop}>
            <ArrowUp className="size-5" />
          </FloatItem>
        )}
        {showFloat && sideBar && user?.isLoggedIn && (
          <FloatItem
            key="create-playlist"
            motionKey="create-playlist"
            onClick={() => create(createPlaylistCreateModal, { onTyping: setTyping, onCreated })}>
            <Plus className="size-5" />
          </FloatItem>
        )}
        {showFloat && sideBar && (
          <motion.div
            key="search"
            className={cx(
              `
                cursor-pointer backdrop-blur-sm rounded-full p-1
                flex items-center justify-center text-primary
                bg-(--text-color-on-main)/60
            `
            )}
            exit={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0 }}
            transition={{ ease: "easeInOut", duration: 0.3 }}>
            <div
              className={cx(
                "relative size-5 ease-in-out duration-300 transition-all flex justify-center items-center pr-5 overflow-hidden contain-strict",
                showInput && "w-30! px-1"
              )}>
              <input
                ref={inputRef}
                className={cx(
                  `
                  w-full h-full outline-none text-sm
                  duration-300 ease-in-out transition-all
                `
                )}
                type="text"
                value={value}
                onFocus={() => setTyping(true)}
                onBlur={() => {
                  setShowInput(false);
                  setTyping(false);
                }}
                onChange={(e) => {
                  setValue(e.target.value);
                  debouncedSearch(e.target.value.trim());
                }}
              />
              <SearchIcon
                className={cx(
                  `
                  size-5 scale-95 absolute right-0 top-1/2
                  -translate-y-1/2 z-10 hover:opacity-60
                  `
                )}
                onClick={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                  setShowInput(true);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default memo(NavFloat);
