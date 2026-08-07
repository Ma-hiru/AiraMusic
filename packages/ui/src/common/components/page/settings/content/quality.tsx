import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { TrackQuality } from "@/common/enum";
import { NeteaseSettings } from "@/common/netease/models";
import Card from "@/common/components/layout/card";
import AppToast from "@/common/components/display/toast";

interface QualityProps {
  vip: boolean;
  data: NeteaseSettings["trackQuality"];
  updateQuality: NormalFunc<[quality: TrackQuality]>;
}

const Quality: FC<QualityProps> = ({ vip, data, updateQuality }) => {
  return (
    <Card title="音质" subTitle="Qulity" Icon={SlidersHorizontal}>
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
        {qualityOptions.map((option) => {
          const active = data.quality === option.value;
          return (
            <Card
              key={option.value}
              className={cx(
                "hover:opacity-50 ease-in-out duration-300 transition-opacity cursor-pointer",
                active && "bg-primary! text-primary-text"
              )}
              onClick={() => {
                if (option.vip && !vip) {
                  return AppToast.show({
                    type: "info",
                    text: "会员专享"
                  });
                }
                updateQuality(option.value);
              }}>
              <div className="flex justify-between gap-1 h-full" title={option.description}>
                <section className="flex flex-col justify-between items-start h-full">
                  <div className="text-md font-bold tracking-normal flex justify-center items-center gap-1">
                    {option.value}
                  </div>
                  <p className="mt-1 text-[11px] font-bold shrink-0">{option.description}</p>
                </section>
                <section className="flex flex-col justify-between items-end h-full">
                  <Check className={cx("size-3.5 shrink-0", !active && "opacity-0")} />
                  {option.vip && (
                    <span
                      className={cx(
                        `
                          text-[8px] font-semibold rounded-sm px-1.5 border border-white/30
                        `,
                        active && "text-primary bg-primary-text"
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
    value: TrackQuality.l,
    description: "标准"
  },
  {
    value: TrackQuality.m,
    description: "平衡"
  },
  {
    value: TrackQuality.h,
    description: "极高"
  },
  {
    value: TrackQuality.sq,
    description: "无损",
    vip: true
  },
  {
    value: TrackQuality.hr,
    description: "高解析度无损",
    vip: true
  }
];
