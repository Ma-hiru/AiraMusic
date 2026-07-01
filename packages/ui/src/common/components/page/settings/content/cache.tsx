import { cx, css } from "@emotion/css";
import { Boxes, Clock8, Folder, HardDrive } from "lucide-react";
import { memo, useRef, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import Card from "@/common/components/layout/card";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import type { CacheStoreCategories } from "@/types/cache";
import type { InvokeEventPayload } from "@mahiru/ipc/types";

import BaseItem from "./base-item";
import RangeRow from "./range-row";
import DonutChart from "./donut-chart";

interface CacheProps {
  refreshSize: NormalFunc;
  cacheStoreSizes: Nullable<CacheStoreCategories>;
  cacheStoreConfig: Nullable<InvokeEventPayload<"invoke_cache_config_get">>;
  updateCacheStoreConfig: PromiseFunc<
    [config: Partial<InvokeEventPayload<"invoke_cache_config_get">>]
  >;
}

const Cache: FC<CacheProps> = ({
  refreshSize,
  cacheStoreSizes,
  cacheStoreConfig,
  updateCacheStoreConfig
}) => {
  const capacityGB = useMemo(() => {
    return RendererFormat.convertBytes(cacheStoreConfig?.capacity, "GB");
  }, [cacheStoreConfig?.capacity]);
  const ttlDays = useMemo(() => {
    return Number(cacheStoreConfig?.ttl.replace("h", "") ?? 0) / 24;
  }, [cacheStoreConfig?.ttl]);
  const path = cacheStoreConfig?.path ?? "";
  const { create, createDialogModal } = AppModal.useModal();

  const [capacityRangeValue, setCapacityRangeValue] = useState(capacityGB);
  const [ttlRangeValue, setTtlRangeValue] = useState(ttlDays);
  const [pathInputValue, setPathInputValue] = useState(path);
  const [movingPercent, setMovingPercent] = useState<Nullable<number>>(null);

  const hasChanged =
    capacityRangeValue !== capacityGB || ttlDays !== ttlRangeValue || path !== pathInputValue;
  const hasData = Object.values(cacheStoreSizes ?? {}).find((s) => s !== 0);

  const selectDirPath = useCallback(async () => {
    const res = await RendererIPC.NormalChannel.send("invoke_fs_select", "dir").then((res) => res);
    if (res.canceled) {
      AppToast.show({ type: "info", text: "取消选择" });
    } else if (res.ok) {
      setPathInputValue(res.path);
    } else {
      res.error && Log.error(res.error);
      AppToast.show({
        type: "warn",
        text: "选择失败"
      });
    }
  }, []);

  const reset = useCallback(() => {
    setPathInputValue(path);
    setTtlRangeValue(ttlDays);
    setCapacityRangeValue(capacityGB);
  }, [capacityGB, path, ttlDays]);

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
      RendererCache.service.other.move(
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

  const clear = useCallback(() => {
    create(createDialogModal, {
      title: "清除缓存",
      body: "是否要清除所有本地缓存？",
      footer: null,
      important: true,
      onConfirm: () => {
        AppModal.close();
        AppToast.show({
          type: "info",
          text: "清理缓存中"
        });
        RendererWindow.main.send("message_dispatch_cache_has_clear", true);
        RendererCache.service.other
          .clear()
          .then((res) => {
            if (res.code === 200) {
              AppToast.show({
                type: "success",
                text: `成功清理 ${res.data} 项缓存`
              });
            } else {
              AppToast.show({
                type: "error",
                text: "清理缓存失败"
              });
            }
          })
          .catch((err) => {
            Log.error(err);
            AppToast.show({
              type: "error",
              text: "内部错误"
            });
          })
          .finally(refreshSize);
      }
    });
  }, [create, createDialogModal, refreshSize]);

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
    AppToast.show({
      type: "success",
      text: "保存成功"
    });
  };
  const refresh = useCallback(() => {
    try {
      refreshSize();
      AppToast.show({
        type: "success",
        text: "刷新成功"
      });
    } catch (err) {
      Log.error(err);
      AppToast.show({
        type: "error",
        text: "刷新失败"
      });
    }
  }, [refreshSize]);

  useEffect(reset, [reset]);

  return (
    <Card title="缓存" Icon={HardDrive} subTitle="Cache">
      <DonutChart cacheStoreSizes={cacheStoreSizes} />
      <RangeRow
        min={1}
        max={20}
        step={1}
        unit="GB"
        icon={Boxes}
        title="缓存容量"
        debounced={false}
        value={capacityRangeValue}
        onChange={setCapacityRangeValue}
      />
      <RangeRow
        min={1}
        max={30}
        step={1}
        unit="天"
        title="保留时间"
        icon={Clock8}
        debounced={false}
        value={ttlRangeValue}
        onChange={setTtlRangeValue}
      />
      <BaseItem
        icon={Folder}
        children={
          <p
            className={cx(
              `
               h-11 flex-1 select-text rounded-md border border-white/30
               px-3 text-[14px] font-semibold
               transition-all duration-300
               flex justify-start items-center
               line-clamp-1 shrink-0 cursor-pointer
               hover:opacity-50
              `
            )}
            onClick={selectDirPath}>
            {pathInputValue}
          </p>
        }
      />
      <BaseItem
        className={cx("py-0!", (movingPercent === null || movingPercent >= 100) && "hidden")}>
        <div className="w-full flex flex-col gap-3">
          <div className="w-full rounded-md bg-white/30 h-1.5 overflow-hidden">
            <span
              className={cx(
                `
                h-1.5 block bg-primary rounded-md
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
          <Button title="保存" disable={!hasChanged} onClick={saveChanges} />
          <Button title="重置" disable={!hasChanged} onClick={reset} />
          <Button title="刷新" disable={false} onClick={refresh} />
          <Button title="清空" disable={!hasData} onClick={clear} />
        </div>
      </BaseItem>
    </Card>
  );
};

export default memo(Cache);

const Button = ({
  onClick,
  title,
  disable
}: {
  title: string;
  disable: boolean;
  onClick: NormalFunc;
}) => {
  return (
    <button
      className={cx(
        `
          shrink-0 h-8 rounded-md border border-white/30 px-3
          text-[12px] font-semibold transition-all duration-300
          hover:bg-primary hover:text-primary-text
          active:scale-[0.98]
        `,
        disable
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-primary hover:text-primary-text  active:scale-[0.98]"
      )}
      title={title}
      type="button"
      onClick={onClick}>
      {title}
    </button>
  );
};
