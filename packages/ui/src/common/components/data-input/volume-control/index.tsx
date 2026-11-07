import { cx } from "@emotion/css";
import { memo, type FC, type WheelEventHandler } from "react";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import Tooltip from "@/common/components/display/tooltip";
import RangeSlider from "@/common/components/data-input/range";
import IconButton from "@/common/components/data-input/icon-button";

export interface VolumeControlProps {
  value: number;
  muted?: boolean;
  className?: string;
  onToggleMute: NormalFunc;
  onChange: NormalFunc<[value: number]>;
  onWheel?: WheelEventHandler<HTMLElement>;
}

const getVolumeIcon = (volume: number) => {
  if (volume <= 0) return VolumeX;
  if (volume <= 15) return Volume;
  if (volume <= 50) return Volume1;
  return Volume2;
};

const VolumeControl: FC<VolumeControlProps> = ({
  className,
  onWheel,
  onChange,
  onToggleMute,
  value,
  muted = false
}) => {
  const volumePercent = Math.max(0, Math.min(100, Math.round(value)));
  const isMuted = muted || volumePercent === 0;
  const VolumeIcon = isMuted ? VolumeX : getVolumeIcon(volumePercent);
  const muteLabel = isMuted ? "取消静音" : "静音";

  return (
    <Tooltip
      className={cx("size-5 items-center justify-center", className)}
      placement="top"
      tooltipLabel="音量调整"
      tooltipRole="group"
      popupClassName="right-0 left-auto! translate-x-0!"
      onWheel={onWheel}
      content={
        <div className="surface-popover w-60 rounded-xl px-3.5 py-3 text-white">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">音量</span>
            <span className="text-[13px] font-semibold tabular-nums">{volumePercent}%</span>
          </div>
          <div className="flex items-center gap-3">
            <IconButton
              size="compact"
              variant="plain"
              icon={VolumeIcon}
              label={muteLabel}
              aria-pressed={isMuted}
              iconClassName="size-4!"
              onClick={onToggleMute}
            />
            <div className="flex h-6 min-w-0 flex-1 items-center">
              <RangeSlider
                className="bg-white/15! focus-visible:ring-white/40! [&>div]:bg-white!"
                min={0}
                step={1}
                max={100}
                label="音量"
                value={volumePercent}
                orientation="horizontal"
                valueText={`${volumePercent}%`}
                onChange={onChange}
              />
            </div>
            <IconButton
              label="最大音量"
              icon={Volume2}
              size="compact"
              variant="plain"
              iconClassName="size-4!"
              onClick={() => onChange(100)}
            />
          </div>
        </div>
      }
      portal
      interactive>
      <IconButton
        size="compact"
        variant="plain"
        icon={VolumeIcon}
        aria-pressed={isMuted}
        title={`悬停调节音量，点击${muteLabel}`}
        label={isMuted ? "取消静音" : `音量 ${volumePercent}%`}
        onClick={onToggleMute}
      />
    </Tooltip>
  );
};

export default memo(VolumeControl);
