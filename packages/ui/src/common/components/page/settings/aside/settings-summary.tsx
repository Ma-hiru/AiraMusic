import { type FC, memo, useMemo } from "react";
import { NeteaseSettings } from "@mahiru/ui/common/source/netease/models";
import { Radio } from "lucide-react";
import { TrackQuality } from "@mahiru/ui/common/enum";

import MiniStat from "./mini-stat";
import Card from "../../../card/card";

interface SummaryProps {
  settings: NeteaseSettings;
}

const GB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;

const SettingsSummary: FC<SummaryProps> = ({ settings }) => {
  const cacheSizeGB = useMemo(
    () => Math.max(1, Math.round(settings.cache.maxCacheSize / GB)),
    [settings.cache.maxCacheSize]
  );

  const cacheTimeDays = useMemo(
    () => Math.max(1, Math.round(settings.cache.maxCacheTime / DAY)),
    [settings.cache.maxCacheTime]
  );

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
        <MiniStat label="缓存容量" value={`${cacheSizeGB}GB`} />
        <MiniStat label="缓存保留" value={`${cacheTimeDays}天`} />
      </div>
    </Card>
  );
};

export default memo(SettingsSummary);
