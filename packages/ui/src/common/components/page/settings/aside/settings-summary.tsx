import { type FC, memo, useMemo } from "react";
import { NeteaseSettings } from "@/common/netease/models";
import { Radio } from "lucide-react";
import { TrackQuality } from "@/common/enum";
import type { InvokeEventPayload } from "@mahiru/ipc/dist-types/src/types/invoke";

import MiniStat from "./mini-stat";
import Card from "@/common/components/card";
import { RendererFormat } from "@/common/lib/format";

interface SummaryProps {
  settings: NeteaseSettings;
  cacheStoreConfig: Nullable<InvokeEventPayload<"fetchCacheStoreConfig">>;
}

const SettingsSummary: FC<SummaryProps> = ({ settings, cacheStoreConfig }) => {
  const capacityGB = useMemo(() => {
    return RendererFormat.convertBytes(cacheStoreConfig?.capacity, "GB");
  }, [cacheStoreConfig?.capacity]);
  const ttlDays = useMemo(() => {
    return Number(cacheStoreConfig?.ttl.replace("h", "") ?? 0) / 24;
  }, [cacheStoreConfig?.ttl]);

  const quality = useMemo(() => {
    switch (settings.trackQuality.quality) {
      case TrackQuality.l:
        return "128K";
      case TrackQuality.m:
        return "192K";
      case TrackQuality.h:
        return "320K";
      case TrackQuality.sq:
        return "SQ";
      case TrackQuality.hr:
        return "Hi-Res";
    }
  }, [settings.trackQuality.quality]);

  return (
    <Card title="设置概览" subTitle="Summary" Icon={Radio}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
        <MiniStat label="默认音质" value={quality} />
        <MiniStat label="缓存容量" value={`${capacityGB}GB`} />
        <MiniStat label="缓存保留" value={`${ttlDays}天`} />
        {(settings.performance.playerSpectrum || settings.performance.barSpectrum) && (
          <MiniStat label="频谱帧率" value={`${settings.performance.spectrumFps}FPS`} />
        )}
      </div>
    </Card>
  );
};

export default memo(SettingsSummary);
