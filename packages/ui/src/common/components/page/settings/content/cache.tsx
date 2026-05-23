import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import { Folder, HardDrive } from "lucide-react";
import {
  NeteaseSettings,
  type NeteaseSettingsModel
} from "@mahiru/ui/common/source/netease/models";

import RangeRow from "./range-row";
import Card from "@mahiru/ui/common/components/card/Card";

interface CacheProps {
  data: NeteaseSettings["cache"];
  updateCache: NormalFunc<[patch: Partial<NeteaseSettingsModel["cache"]>]>;
}

const GB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;

const Cache: FC<CacheProps> = ({ data, updateCache }) => {
  const cacheSizeGB = useMemo(
    () => Math.max(1, Math.round(data.maxCacheSize / GB)),
    [data.maxCacheSize]
  );
  const cacheTimeDays = useMemo(
    () => Math.max(1, Math.round(data.maxCacheTime / DAY)),
    [data.maxCacheTime]
  );
  return (
    <Card Icon={HardDrive} title="缓存" subTitle="Cache">
      <RangeRow
        title="缓存容量"
        value={`${cacheSizeGB}GB`}
        min={1}
        max={20}
        step={1}
        rangeValue={cacheSizeGB}
        onChange={(value) => updateCache({ maxCacheSize: value * GB })}
      />
      <RangeRow
        title="保留时间"
        value={`${cacheTimeDays}天`}
        min={1}
        max={30}
        step={1}
        rangeValue={cacheTimeDays}
        onChange={(value) => updateCache({ maxCacheTime: value * DAY })}
      />
      <Card Icon={Folder} title="缓存路径" subTitle="Cache Path">
        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            value={data.cachePath}
            onChange={(event) => updateCache({ cachePath: event.currentTarget.value })}
            placeholder="使用默认缓存目录"
            className={cx(
              `
                  h-11 min-w-0 flex-1 select-text rounded-md border border-zinc-950/10
                  bg-white/55 px-3 text-[12px] font-semibold   outline-none
                  transition-all duration-300 placeholder:text-zinc-400
                  focus:border-(--theme-color-main) focus:bg-white/80
                `
            )}
          />
          <button
            type="button"
            title="恢复默认缓存路径"
            onClick={() => updateCache({ cachePath: "" })}
            className={cx(
              `
                  h-11 rounded-md border border-white/30   px-4
                  text-[12px] font-black   transition-all duration-300
                  hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
                  active:scale-[0.98]
                `
            )}>
            使用默认
          </button>
        </div>
      </Card>
    </Card>
  );
};

export default memo(Cache);
