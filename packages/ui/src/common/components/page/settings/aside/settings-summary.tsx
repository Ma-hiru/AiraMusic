import { type FC, memo, useMemo } from "react";
import { NeteaseSettings } from "@/common/netease/models";
import { Radio } from "lucide-react";
import { RendererFormat } from "@/common/lib/format";
import type { InvokeEventPayload } from "@mahiru/ipc/dist-types/src/types/invoke";

import MiniStat from "./mini-stat";
import Card from "@/common/components/layout/card";

interface SummaryProps {
  settings: NeteaseSettings;
  cacheStoreConfig: Nullable<InvokeEventPayload<"invoke_cache_config_get">>;
}

const SettingsSummary: FC<SummaryProps> = ({ settings, cacheStoreConfig }) => {
  const capacityGB = useMemo(() => {
    return RendererFormat.convertBytes(cacheStoreConfig?.capacity, "GB");
  }, [cacheStoreConfig?.capacity]);
  const ttlDays = useMemo(() => {
    return Number(cacheStoreConfig?.ttl.replace("h", "") ?? 0) / 24;
  }, [cacheStoreConfig?.ttl]);

  return (
    <Card title="设置概览" subTitle="Summary" Icon={Radio}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2">
        <MiniStat label="默认音质" value={settings.trackQuality.quality} />
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
