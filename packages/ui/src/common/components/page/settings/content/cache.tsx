import { css, cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Clock8, Folder, HardDrive } from "lucide-react";
import type { InvokeEventPayload } from "@mahiru/ipc/dist-types/src/types/invoke";
import { RendererFormat } from "@/common/lib/format";
import { RendererIPC } from "@/common/lib/ipc";
import AppToast from "@/common/components/toast";

import RangeRow from "./range-row";
import BaseItem from "./base-item";
import DonutChart from "./donut-chart";
import Card from "@/common/components/card";
import { CacheStore } from "@/common/store/cache";

interface CacheProps {
  cacheStoreSizes: Nullable<CacheStoreSizeCategories>;
  cacheStoreConfig: Nullable<InvokeEventPayload<"fetchCacheStoreConfig">>;
  updateCacheStoreConfig: PromiseFunc<
    [config: Partial<InvokeEventPayload<"fetchCacheStoreConfig">>]
  >;
}

const Cache: FC<CacheProps> = ({ cacheStoreConfig, cacheStoreSizes, updateCacheStoreConfig }) => {
  const capacityGB = useMemo(() => {
    return RendererFormat.convertBytes(cacheStoreConfig?.capacity, "GB");
  }, [cacheStoreConfig?.capacity]);
  const ttlDays = useMemo(() => {
    return Number(cacheStoreConfig?.ttl.replace("h", "") ?? 0) / 24;
  }, [cacheStoreConfig?.ttl]);
  const path = cacheStoreConfig?.path ?? "";

  const [capacityRangeValue, setCapacityRangeValue] = useState(capacityGB);
  const [ttlRangeValue, setTtlRangeValue] = useState(ttlDays);
  const [pathInputValue, setPathInputValue] = useState(path);

  const hasChanged =
    capacityRangeValue !== capacityGB || ttlDays !== ttlRangeValue || path !== pathInputValue;
  const selectDirPath = useCallback(async () => {
    const res = await RendererIPC.Invoke("selectPath", "dir").then((res) => res);
    if (res.ok) {
      setPathInputValue(res.path);
    } else {
      res.error &&
        AppToast.show({
          type: "warn",
          text: res.error
        });
    }
  }, []);

  const reset = useCallback(() => {
    setPathInputValue(path);
    setTtlRangeValue(ttlDays);
    setCapacityRangeValue(capacityGB);
  }, [capacityGB, path, ttlDays]);

  const [movingPercent, setMovingPercent] = useState<Nullable<number>>(null);

  const moving = useRef(false);
  const moveStore = useCallback((path: string) => {
    if (moving.current) return Promise.resolve(false);
    moving.current = true;
    setMovingPercent(0);
    AppToast.show({
      type: "info",
      text: "移动中，请勿关闭页面"
    });

    return new Promise<boolean>((resolve) => {
      CacheStore.local.other.move(
        path,
        (data) => data && setMovingPercent(data.percent),
        (err) => {
          moving.current = false;
          if (err) {
            AppToast.show({
              type: "error",
              text: err
            });
            resolve(false);
            return;
          }

          AppToast.show({
            type: "success",
            text: "移动成功"
          });
          resolve(true);
        }
      );
    });
  }, []);

  const saveChanges = async () => {
    if (!hasChanged) return;
    const config: Partial<{ ttl: string; path: string; capacity: number }> = {};
    if (path !== pathInputValue) {
      const moved = await moveStore(pathInputValue);
      if (!moved) return;
      config.path = pathInputValue;
    }
    if (capacityGB !== capacityRangeValue) {
      config.capacity = capacityRangeValue * 1024 ** 3;
    }
    if (ttlDays !== ttlRangeValue) {
      config.ttl = ttlRangeValue * 24 + "h";
    }
    if (Object.entries(config).length === 0) return;
    await updateCacheStoreConfig(config);
  };

  useEffect(reset, [reset]);
  return (
    <Card
      className="ease-in-out duration-300 transition-all"
      Icon={HardDrive}
      title="缓存"
      subTitle="Cache">
      <DonutChart cacheStoreSizes={cacheStoreSizes} />
      <RangeRow
        icon={Boxes}
        title="缓存容量"
        value={`${capacityGB}GB`}
        min={1}
        max={20}
        step={1}
        debounced={false}
        rangeValue={capacityRangeValue}
        onChange={setCapacityRangeValue}
      />
      <RangeRow
        icon={Clock8}
        title="保留时间"
        value={`${ttlDays}天`}
        min={1}
        max={30}
        step={1}
        debounced={false}
        rangeValue={ttlRangeValue}
        onChange={setTtlRangeValue}
      />
      <BaseItem
        icon={Folder}
        children={
          <p
            onClick={selectDirPath}
            className={cx(
              `
               h-11 flex-1 select-text rounded-md border border-white/30
               px-3 text-[14px] font-semibold
               transition-all duration-300
               flex justify-start items-center
               line-clamp-1 shrink-0 cursor-pointer
               hover:opacity-50
              `
            )}>
            {pathInputValue}
          </p>
        }
      />
      <BaseItem
        className={cx("py-0!", movingPercent === null || (movingPercent >= 100 && "hidden"))}>
        <div className="w-full flex flex-col gap-3">
          <div className="w-full rounded-md bg-white/30 h-1.5 overflow-hidden">
            <span
              className={cx(
                `
                h-1.5 block bg-(--theme-color-main) rounded-md
                ease-in-out transition-all duration-300
              `,
                css`
                  width: ${movingPercent ?? 0}%;
                `
              )}
            />
          </div>
          <div className="flex justify-between gap-3 text-[12px] font-medium">
            <span>移动中</span>
            <span>{movingPercent ?? 0} %</span>
          </div>
        </div>
      </BaseItem>
      <BaseItem>
        <div className="w-full flex justify-end gap-3">
          <Button hasChanged={hasChanged} title="保存" onClick={saveChanges} />
          <Button hasChanged={hasChanged} title="重置" onClick={reset} />
        </div>
      </BaseItem>
    </Card>
  );
};

export default memo(Cache);

const Button = ({
  hasChanged,
  title,
  onClick
}: {
  hasChanged: boolean;
  title: string;
  onClick: NormalFunc;
}) => {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        `
          shrink-0 h-8 rounded-md border border-white/30 px-3
          text-[12px] font-black transition-all duration-300
          hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
          active:scale-[0.98]
        `,
        !hasChanged && "opacity-50 cursor-not-allowed",
        hasChanged &&
          "hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)  active:scale-[0.98]"
      )}>
      {title}
    </button>
  );
};
