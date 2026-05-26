import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { NeteaseSettings } from "@mahiru/ui/common/source/netease/models";
import { TrackQuality } from "@mahiru/ui/common/enum";

import Card from "../../../card/card";

interface QualityProps {
  data: NeteaseSettings["trackQuality"];
  updateQuality: NormalFunc<[quality: TrackQuality]>;
}

const Quality: FC<QualityProps> = ({ data, updateQuality }) => {
  return (
    <Card title="音质" subTitle="Qulity" Icon={SlidersHorizontal}>
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
        {qualityOptions.map((option) => {
          const active = data.quality === option.value;
          return (
            <Card key={option.value} onClick={() => updateQuality(option.value)}>
              <div className="flex justify-between gap-1 h-full">
                <section className="flex flex-col justify-between items-start h-full">
                  <div
                    className={cx(
                      "text-md font-black tracking-normal flex justify-center items-center gap-1",
                      active && "text-(--theme-color-main)"
                    )}>
                    {option.label}
                  </div>
                  <p
                    className={cx(
                      "mt-1 text-[11px] font-bold shrink-0",
                      active && "text-(--theme-color-main)"
                    )}>
                    {option.description}
                  </p>
                </section>
                <section className="flex flex-col justify-between items-end h-full">
                  <Check
                    className={cx(
                      "size-3.5 shrink-0 text-(--theme-color-main)",
                      !active && "opacity-0"
                    )}
                  />
                  {option.vip && (
                    <span
                      className={cx(
                        `
                          text-[8px] font-black rounded-sm px-1.5 border border-white/30
                        `,
                        active && "bg-(--theme-color-main) text-(--text-color-on-main)"
                      )}>
                      VIP
                    </span>
                  )}
                </section>
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
};

export default memo(Quality);

const qualityOptions = [
  {
    label: "128K",
    value: TrackQuality.l,
    description: "标准"
  },
  {
    label: "192K",
    value: TrackQuality.m,
    description: "平衡"
  },
  {
    label: "320K",
    value: TrackQuality.h,
    description: "极高"
  },
  {
    label: "SQ",
    value: TrackQuality.sq,
    description: "无损",
    vip: true
  },
  {
    label: "Hi-Res",
    value: TrackQuality.hr,
    description: "高解析度无损",
    vip: true
  }
];
