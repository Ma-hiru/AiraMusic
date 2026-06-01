import dayjs, { type OpUnitType, type QUnitType } from "dayjs";
import { NeteaseMusicLevel, TrackQuality } from "@/common/enum";

export class RendererFormat {
  static count(count: Optional<number>) {
    if ((!count && count !== 0) || !Number.isFinite(count)) return "";
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}w+`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k+`;
    }
    return String(count);
  }

  static time(millTimestamp: Optional<number>, split?: string) {
    if ((!millTimestamp && millTimestamp !== 0) || !Number.isFinite(millTimestamp)) return "";

    const before = dayjs(millTimestamp);
    const now = dayjs();
    if (now.diff(before, "minute") <= 1) {
      return "刚刚";
    } else if (now.diff(before, "day") <= 0) {
      return before.format("HH:mm");
    }
    return dayjs(millTimestamp).format(`YYYY${split ?? "-"}MM${split ?? "-"}DD`);
  }

  static duration(time: Optional<number>, unit: "ms" | "s" = "ms", split?: string) {
    if (!time) return "0:00";
    split ||= ":";
    let base;
    if (unit === "ms") {
      base = 1000;
    } else {
      base = 1;
    }
    const minutes = Math.floor(time / (60 * base));
    const seconds = Math.floor((time % (60 * base)) / base);
    const paddedSeconds = seconds.toString().padStart(2, "0");
    return `${minutes}${split}${paddedSeconds}`;
  }

  static diff(timestamp: Optional<number>, unit: QUnitType | OpUnitType) {
    if (timestamp == null) return 0;
    const now = dayjs();
    const before = dayjs(timestamp);
    return now.diff(before, unit);
  }

  static yearsAndDays(timestamp: Optional<number>) {
    if (timestamp == null) return "-天";
    const start = dayjs(timestamp);
    const today = dayjs();
    const years = today.diff(start, "year");
    const afterYears = start.add(years, "year");
    const days = Math.max(today.diff(afterYears, "day"), 1);
    if (years <= 0) return `${days}天`;
    return `${years}年${days}天`;
  }

  static convertBytes(bytes: Optional<number>, unit: "GB" | "MB" | "KB" | "B" | "b") {
    if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) {
      return 0;
    }

    let value: number | string;
    if (unit === "GB") {
      value = bytes / 1024 ** 3;
    } else if (unit === "MB") {
      value = bytes / 1024 ** 2;
    } else if (unit === "KB") {
      value = bytes / 1024 ** 1;
    } else if (unit === "B") {
      value = bytes;
    } else {
      value = bytes * 8;
    }

    if (!Number.isInteger(value)) value = value.toFixed(1);

    return Number(value);
  }

  static size(bytes: Optional<number>) {
    if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "0";
    if (bytes < 1) return RendererFormat.convertBytes(bytes, "b") + "b";
    else if (bytes < 1024 ** 1) return RendererFormat.convertBytes(bytes, "B") + "B";
    else if (bytes < 1024 ** 2) return RendererFormat.convertBytes(bytes, "KB") + "KB";
    else if (bytes < 1024 ** 3) return RendererFormat.convertBytes(bytes, "MB") + "MB";
    return RendererFormat.convertBytes(bytes, "GB") + "GB";
  }

  static musicLevel(quality: TrackQuality) {
    switch (quality) {
      case TrackQuality.l:
        return NeteaseMusicLevel.standard;
      case TrackQuality.m:
        return NeteaseMusicLevel.higher;
      case TrackQuality.h:
        return NeteaseMusicLevel.exhigh;
      case TrackQuality.sq:
        return NeteaseMusicLevel.lossless;
      case TrackQuality.hr:
        return NeteaseMusicLevel.hires;
    }
  }

  static weekRecord(res: NeteaseAPI.NeteaseWeekDurationResponse) {
    const total = res.data.listenTimeDistributionBlock.playDuration;
    const details = res.data.listenTimeDistributionBlock.durationDetails;
    const today = details[details.length - 1];
    const weekDays = details.length;
    const todayTrackCount = res.data.weekTodayListenBlock.songCount;
    return {
      total,
      today,
      details,
      weekDays,
      todayTrackCount
    };
  }

  static monthRecord(res: NeteaseAPI.NeteaseMonthDurationResponse) {
    const total = res.data.listenTimeDistributionBlock.playDuration;
    const details = res.data.listenTimeDistributionBlock.durationDetails;
    const today = details[details.length - 1] ?? 0;
    const days = details.length;
    return {
      total,
      today,
      details,
      days
    };
  }
}
