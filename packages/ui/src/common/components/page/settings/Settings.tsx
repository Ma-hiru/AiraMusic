import { cx } from "@emotion/css";
import { type FC, memo, type ReactNode, useCallback, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BadgeCheck,
  Check,
  Folder,
  Gauge,
  HardDrive,
  LogOut,
  Monitor,
  Radio,
  SlidersHorizontal,
  UserRound
} from "lucide-react";
import { NeteaseImageSize, TrackQuality } from "@mahiru/ui/common/enum";
import {
  NeteaseNetworkImage,
  NeteaseSettings,
  type NeteaseSettingsModel,
  NeteaseUser,
  type NeteaseUserModel
} from "@mahiru/ui/common/source/netease/models";

import NeteaseImage from "@mahiru/ui/common/components/image/NeteaseImage";

interface SettingsProps {
  user: Nullable<NeteaseUser>;
  settings: NeteaseSettings;
  updateUser: NormalFunc<[user: Optional<NeteaseUserModel>]>;
  updateSettings: NormalFunc<[settings: NeteaseSettingsModel]>;
}

const GB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;

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

const Settings: FC<SettingsProps> = ({ user, settings, updateSettings, updateUser }) => {
  const avatar = useMemo(
    () => NeteaseNetworkImage.fromUserAvatar(user)?.setSize(NeteaseImageSize.sm),
    [user]
  );

  const cacheSizeGB = useMemo(
    () => Math.max(1, Math.round(settings.cache.maxCacheSize / GB)),
    [settings.cache.maxCacheSize]
  );
  const cacheTimeDays = useMemo(
    () => Math.max(1, Math.round(settings.cache.maxCacheTime / DAY)),
    [settings.cache.maxCacheTime]
  );
  const quality = useMemo(
    () => qualityOptions.find((option) => option.value === settings.trackQuality.quality),
    [settings.trackQuality.quality]
  );

  const patchSettings = useCallback(
    (patch: Partial<NeteaseSettingsModel>) => {
      updateSettings({
        trackQuality: patch.trackQuality ?? { ...settings.trackQuality },
        performance: patch.performance ?? { ...settings.performance },
        window: patch.window ?? { ...settings.window },
        cache: patch.cache ?? { ...settings.cache }
      });
    },
    [settings, updateSettings]
  );

  const updateQuality = useCallback(
    (next: TrackQuality) => {
      patchSettings({
        trackQuality: {
          ...settings.trackQuality,
          uid: user?.profile.userId ?? settings.trackQuality.uid,
          quality: next
        }
      });
    },
    [patchSettings, settings.trackQuality, user?.profile.userId]
  );

  const updateCache = useCallback(
    (patch: Partial<NeteaseSettingsModel["cache"]>) => {
      patchSettings({
        cache: {
          ...settings.cache,
          ...patch
        }
      });
    },
    [patchSettings, settings.cache]
  );

  const profileName = user?.profile.nickname ?? "未登录";
  const profileSignature = user?.profile.signature || "暂无签名";

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-hide text-zinc-950">
      <section
        className={cx(
          `
          min-h-full pb-6
          grid grid-cols-1 xl:grid-cols-[minmax(260px,0.82fr)_minmax(520px,1.58fr)]
          gap-4
        `
        )}>
        <aside className="flex min-h-0 flex-col gap-4">
          <section
            className={cx(
              `
              relative overflow-hidden rounded-lg border border-white/45
              bg-[linear-gradient(145deg,rgba(255,255,255,0.82),rgba(255,255,255,0.36))]
              p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] backdrop-blur-2xl
            `
            )}>
            <div className="absolute inset-x-0 top-0 h-1 bg-(--theme-color-main)" />
            <div className="flex items-center gap-3">
              {avatar ? (
                <NeteaseImage
                  cacheLazy={false}
                  cache
                  image={avatar}
                  className="size-16 rounded-lg border border-white/70"
                  shadow="float"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-lg border border-white/70 bg-white/45">
                  <UserRound className="size-8 text-zinc-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-xl font-black tracking-normal">{profileName}</h1>
                  {user?.isVIP() && (
                    <BadgeCheck className="size-4 shrink-0 text-(--theme-color-main)" />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-600">
                  {profileSignature}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniStat label="创建" value={user?.userPlaylists.length ?? 0} />
              <MiniStat label="收藏" value={user?.starPlaylists.length ?? 0} />
              <MiniStat label="模式" value={user?.isVIP() ? "VIP" : "普通"} />
            </div>

            <button
              type="button"
              title="退出登录"
              onClick={() => updateUser(null)}
              className={cx(
                `
                mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md
                border border-zinc-950/10 bg-white/35 text-[12px] font-bold text-zinc-700
                transition-all duration-300 hover:border-(--theme-color-main)/40
                hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
                active:scale-[0.98]
              `
              )}>
              <LogOut className="size-3.5" />
              退出当前账号
            </button>
          </section>

          <section
            className={cx(
              `
              rounded-lg border border-white/40 bg-white/42 p-4
              shadow-[0_12px_35px_rgba(0,0,0,0.10)] backdrop-blur-2xl
            `
            )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Current
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-normal">播放策略</h2>
              </div>
              <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
                <Radio className="size-5" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <SignalLine
                label="默认音质"
                value={quality?.detail ?? "HD"}
                percent={qualityPercent(settings.trackQuality.quality)}
              />
              <SignalLine
                label="缓存容量"
                value={`${cacheSizeGB}GB`}
                percent={Math.min(100, Math.round((cacheSizeGB / 20) * 100))}
              />
              <SignalLine
                label="缓存保留"
                value={`${cacheTimeDays}天`}
                percent={Math.min(100, Math.round((cacheTimeDays / 30) * 100))}
              />
            </div>
          </section>
        </aside>

        <main className="min-h-0 space-y-4">
          <section
            className={cx(
              `
              rounded-lg border border-white/45 bg-white/50 p-4
              shadow-[0_18px_55px_rgba(0,0,0,0.12)] backdrop-blur-2xl
            `
            )}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  AiraMusic Settings
                </p>
                <h2 className="mt-1 text-3xl font-black tracking-normal">声音与窗口</h2>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-zinc-950/10 bg-white/45 px-3 py-2 text-[12px] font-bold text-zinc-600">
                <SlidersHorizontal className="size-4 text-(--theme-color-main)" />
                {quality?.label ?? "极高"} ·{" "}
                {settings.performance.barSpectrum ? "频谱开启" : "安静模式"}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 lg:grid-cols-5">
              {qualityOptions.map((option) => {
                const active = settings.trackQuality.quality === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={`切换到${option.label}音质`}
                    onClick={() => updateQuality(option.value)}
                    className={cx(
                      `
                      group relative min-h-28 overflow-hidden rounded-md border p-3 text-left
                      transition-all duration-300 active:scale-[0.98]
                    `,
                      active
                        ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_16px_35px_rgba(0,0,0,0.22)]"
                        : "border-zinc-950/10 bg-white/40 text-zinc-700 hover:border-(--theme-color-main)/50 hover:bg-white/70"
                    )}>
                    <div
                      className={cx(
                        "h-1.5 w-10 rounded-full transition-all duration-300 group-hover:w-14",
                        option.tone
                      )}
                    />
                    <div className="mt-5 flex items-start justify-between gap-2">
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
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SettingsGroup icon={Gauge} title="性能" eyebrow="Performance">
              <ToggleRow
                icon={AudioLines}
                title="播放栏频谱"
                description="让底部播放栏跟着音乐轻微呼吸。"
                checked={settings.performance.barSpectrum}
                onClick={() =>
                  patchSettings({
                    performance: {
                      ...settings.performance,
                      barSpectrum: !settings.performance.barSpectrum
                    }
                  })
                }
              />
              <ToggleRow
                icon={Monitor}
                title="默认使用展示窗"
                description="从主窗口打开内容时优先投到 Display 窗口。"
                checked={settings.window.defaultUseDisplayWindow}
                onClick={() =>
                  patchSettings({
                    window: {
                      ...settings.window,
                      defaultUseDisplayWindow: !settings.window.defaultUseDisplayWindow
                    }
                  })
                }
              />
            </SettingsGroup>

            <SettingsGroup icon={HardDrive} title="缓存" eyebrow="Cache">
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
            </SettingsGroup>
          </div>

          <section
            className={cx(
              `
              rounded-lg border border-white/40 bg-white/46 p-4
              shadow-[0_12px_35px_rgba(0,0,0,0.10)] backdrop-blur-2xl
            `
            )}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
                <Folder className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                  Storage
                </p>
                <h2 className="text-xl font-black tracking-normal">缓存路径</h2>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 md:flex-row">
              <input
                value={settings.cache.cachePath}
                onChange={(event) => updateCache({ cachePath: event.currentTarget.value })}
                placeholder="使用默认缓存目录"
                className={cx(
                  `
                  h-11 min-w-0 flex-1 select-text rounded-md border border-zinc-950/10
                  bg-white/55 px-3 text-[12px] font-semibold text-zinc-700 outline-none
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
                  h-11 rounded-md border border-zinc-950/10 bg-zinc-950 px-4
                  text-[12px] font-black text-white transition-all duration-300
                  hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
                  active:scale-[0.98]
                `
                )}>
                使用默认
              </button>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
};

export default memo(Settings);

const MiniStat: FC<{ label: string; value: string | number }> = memo(({ label, value }) => {
  return (
    <div className="rounded-md border border-zinc-950/10 bg-white/35 px-2 py-2">
      <p className="truncate text-[10px] font-bold text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black tracking-normal text-zinc-900">{value}</p>
    </div>
  );
});

MiniStat.displayName = "MiniStat";

const SignalLine: FC<{ label: string; value: string; percent: number }> = memo(
  ({ label, value, percent }) => {
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
          <span className="text-zinc-500">{label}</span>
          <span className="text-zinc-900">{value}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-950/10">
          <div
            className="h-full rounded-full bg-(--theme-color-main)"
            style={{ width: `${Math.max(8, Math.min(100, percent))}%` }}
          />
        </div>
      </div>
    );
  }
);

SignalLine.displayName = "SignalLine";

const SettingsGroup: FC<{
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  children: ReactNode;
}> = memo(({ icon: Icon, title, eyebrow, children }) => {
  return (
    <section
      className={cx(
        `
        rounded-lg border border-white/40 bg-white/46 p-4
        shadow-[0_12px_35px_rgba(0,0,0,0.10)] backdrop-blur-2xl
      `
      )}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
            {eyebrow}
          </p>
          <h2 className="text-xl font-black tracking-normal">{title}</h2>
        </div>
      </div>
      <div className="divide-y divide-zinc-950/10">{children}</div>
    </section>
  );
});

SettingsGroup.displayName = "SettingsGroup";

const ToggleRow: FC<{
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onClick: NormalFunc;
}> = memo(({ icon: Icon, title, description, checked, onClick }) => {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-950/5 text-zinc-700">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-black tracking-normal text-zinc-900">{title}</h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        title={checked ? "关闭" : "开启"}
        onClick={onClick}
        className={cx(
          `
          relative h-7 w-12 shrink-0 rounded-full border transition-all duration-300
          active:scale-95
        `,
          checked
            ? "border-(--theme-color-main) bg-(--theme-color-main)"
            : "border-zinc-950/10 bg-zinc-950/10"
        )}>
        <span
          className={cx(
            `
            absolute top-1 size-5 rounded-full bg-white shadow-sm
            transition-all duration-300
          `,
            checked ? "left-6" : "left-1"
          )}
        />
      </button>
    </div>
  );
});

ToggleRow.displayName = "ToggleRow";

const RangeRow: FC<{
  title: string;
  value: string;
  min: number;
  max: number;
  step: number;
  rangeValue: number;
  onChange: NormalFunc<[value: number]>;
}> = memo(({ title, value, min, max, step, rangeValue, onChange }) => {
  return (
    <div className="py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-black tracking-normal text-zinc-900">{title}</h3>
        <span className="rounded-md bg-zinc-950 px-2 py-1 text-[11px] font-black text-white">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rangeValue}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full cursor-pointer accent-(--theme-color-main)"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-zinc-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
});

RangeRow.displayName = "RangeRow";

function qualityPercent(quality: TrackQuality) {
  switch (quality) {
    case TrackQuality.l:
      return 20;
    case TrackQuality.m:
      return 40;
    case TrackQuality.h:
      return 62;
    case TrackQuality.sq:
      return 82;
    case TrackQuality.hr:
      return 100;
  }
}
