import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { NeteaseSettings } from "@mahiru/ui/common/source/netease/models";
import { TrackQuality } from "@mahiru/ui/common/enum";

import Card from "@mahiru/ui/common/components/card/Card";

interface QualityProps {
  data: NeteaseSettings["trackQuality"];
  updateQuality: NormalFunc<[quality: TrackQuality]>;
}

const Quality: FC<QualityProps> = ({ data, updateQuality }) => {
  return (
    <Card title="音质" subTitle="Qulity" Icon={SlidersHorizontal}>
      <div className="mt-5 grid grid-cols-1 gap-2 lg:grid-cols-5">
        {qualityOptions.map((option) => {
          const active = data.quality === option.value;
          return (
            <Card key={option.value} onClick={() => updateQuality(option.value)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black tracking-normal">{option.label}</p>
                  <p
                    className={cx(
                      "mt-1 text-[11px] font-bold",
                      active ? "text-white/60" : "text-zinc-500"
                    )}>
                    {option.description}
                  </p>
                </div>
                {active && <Check className="size-4 shrink-0 text-(--theme-color-main)" />}
              </div>
              <p
                className={cx(
                  "absolute bottom-2 right-3 text-[11px] font-black",
                  active ? "text-white/45" : "text-zinc-400"
                )}>
                {option.detail}
              </p>
            </Card>
          );
        })}
      </div>
    </Card>
  );
};

export default memo(Quality);

const qualityOptions: {
  label: string;
  detail: string;
  value: TrackQuality;
  tone: string;
  description: string;
}[] = [
  {
    label: "流畅",
    detail: "128K",
    value: TrackQuality.l,
    tone: "bg-emerald-500",
    description: "移动网络友好"
  },
  {
    label: "均衡",
    detail: "192K",
    value: TrackQuality.m,
    tone: "bg-sky-500",
    description: "日常播放"
  },
  {
    label: "极高",
    detail: "320K",
    value: TrackQuality.h,
    tone: "bg-(--theme-color-main)",
    description: "默认推荐"
  },
  {
    label: "无损",
    detail: "SQ",
    value: TrackQuality.sq,
    tone: "bg-amber-400",
    description: "收藏曲库"
  },
  {
    label: "母带",
    detail: "Hi-Res",
    value: TrackQuality.hr,
    tone: "bg-fuchsia-500",
    description: "优先最高质量"
  }
];
