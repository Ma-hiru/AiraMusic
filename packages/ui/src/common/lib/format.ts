import dayjs from "dayjs";

export class FormatNumber {
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
}
