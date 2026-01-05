import { FC, memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Time } from "@mahiru/ui/utils/time";
import Color from "color";

interface SearchHostListProps {
  show: boolean;
  hotSearchList: NeteaseSearchHotListDetail[];
  onClick?: (keyword: string) => void;
  themeSync: ThemeSync;
}

const SearchHostList: FC<SearchHostListProps> = ({ show, hotSearchList, onClick, themeSync }) => {
  return (
    <AnimatePresence>
      {show && !!hotSearchList.length && (
        <motion.div
          initial={{
            opacity: 0,
            height: 0
          }}
          animate={{
            opacity: 1,
            height: "auto"
          }}
          exit={{
            opacity: 0,
            height: 0
          }}
          transition={{
            duration: 0.3,
            ease: "easeInOut"
          }}>
          <div
            style={{
              background: Color(themeSync.mainColor).alpha(0.8).string(),
              color: themeSync.textColorOnMain
            }}
            className="flex flex-col gap-2 mt-4 overflow-hidden bg-white/20 rounded-md px-4 py-2">
            <div className="text-left font-semibold text-sm">热搜列表</div>
            <div className="grid grid-cols-2 justify-items-start">
              {hotSearchList.map((item, index) => {
                return (
                  <div
                    className="mx-2 text-[14px] opacity-80 cursor-pointer hover:opacity-50 active:scale-90 ease-in-out transition-all duration-300"
                    key={item.searchWord}
                    onClick={() => {
                      onClick?.(item.searchWord);
                    }}>
                    {`${Time.padNumber(index + 1, 2)}. ${item.searchWord}`}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default memo(SearchHostList);
