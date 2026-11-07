import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseNetworkImage, type NeteaseTrackRecord } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";

import type { ModalRender } from "./modal-provider";

type Quality = { br: number; sr: number; size: number };

/** 服务端给出的最高音质档位，缺失时按码率回退 */
const qualityLabels: Record<string, string> = {
  jymaster: "母带",
  hires: "Hi-Res",
  lossless: "无损",
  exhigh: "极高",
  higher: "较高",
  standard: "标准"
};

const feeLabels: Record<number, string> = {
  0: "免费",
  1: "VIP",
  4: "付费专辑",
  8: "免费低音质"
};

function pickBestQuality(track: NeteaseTrackRecord): Nullable<Quality> {
  const detail = track.detail;
  const list: Quality[] = [detail.hr, detail.sq, detail.h, detail.m, detail.l]
    .map((item) => ({ br: item?.br ?? 0, size: item?.size ?? 0, sr: item?.sr ?? 0 }))
    .filter((item) => Number.isFinite(item.br) && item.br > 0);
  if (!list.length) return null;
  return list.reduce((best, item) => (item.br > best.br ? item : best));
}

function pickQualityLabel(track: NeteaseTrackRecord, best: Nullable<Quality>) {
  const level = track.detail.privilege?.maxBrLevel;
  if (level && qualityLabels[level]) return qualityLabels[level];
  if (!best) return "-";
  if (best.br >= 900_000) return "无损";
  if (best.br >= 320_000) return "极高";
  if (best.br >= 192_000) return "较高";
  return "标准";
}

function formatSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "-";
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatSampleRate(sr: number) {
  if (!Number.isFinite(sr) || sr <= 0) return "-";
  return `${+(sr / 1000).toFixed(1)} kHz`;
}

/** 歌曲信息弹层：只读当前曲目已加载的元数据，不发请求 */
export function createTrackInfoModal({ track }: { track: NeteaseTrackRecord }): ModalRender {
  const detail = track.detail;
  const cover = NeteaseNetworkImage.fromTrackCover(track).setSize(NeteaseImageSize.md);
  const best = pickBestQuality(track);
  const rows: { label: string; value: string }[] = [
    { label: "时长", value: RendererFormat.duration(detail.dt) },
    { label: "发行", value: RendererFormat.time(detail.publishTime, "-") || "-" },
    { label: "曲序", value: detail.no > 0 ? `第 ${detail.no} 首` : "-" },
    { label: "音质", value: pickQualityLabel(track, best) },
    { label: "码率", value: best ? `${Math.round(best.br / 1000)} kbps` : "-" },
    { label: "采样率", value: best ? formatSampleRate(best.sr) : "-" },
    { label: "文件大小", value: best ? formatSize(best.size) : "-" },
    { label: "付费", value: feeLabels[detail.fee] ?? "未知" },
    { label: "MV", value: detail.mv > 0 ? "有" : "无" }
  ];
  return {
    title: "歌曲信息",
    subTitle: "Track",
    width: 520,
    height: 272,
    content: (
      <div className="flex h-full min-h-0 gap-4">
        <div className="flex shrink-0 flex-col gap-1">
          <NeteaseImage
            className="aspect-square h-32 w-32 shrink-0 select-none rounded-md"
            image={cover}
            shadowColor="light"
            cache
          />
          {/* 歌曲 ID 只对开发者有意义，仅在 dev 构建里挂在封面下方 */}
          {import.meta.env.DEV && (
            <p className="text-[10px] leading-4 tabular-nums opacity-40">歌曲 ID · {detail.id}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">{detail.name}</p>
            <p className="mt-1 truncate text-[12px] opacity-60">
              {[detail.artist.join(" / "), detail.al?.name].filter(Boolean).join(" · ")}
            </p>
            {detail.alia.length > 0 && (
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 opacity-45 italic">
                {detail.alia.join(" / ")}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
            {rows.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] leading-4 opacity-50">{label}</dt>
                <dd className="truncate text-[12px] font-semibold leading-4 tabular-nums opacity-85">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    )
  };
}

export default createTrackInfoModal;
