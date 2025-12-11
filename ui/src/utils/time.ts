import Dayjs from "dayjs";
import { getPersistSnapshot } from "@mahiru/ui/store";

function formatTrackDate(time?: number, split?: string) {
  if (time) {
    const date = Dayjs(time);
    const now = Dayjs();
    split ||= "-";
    if (date.year() === now.year()) {
      return date.format(`MM${split}DD`);
    } else {
      return date.format(`YYYY${split}MM${split}DD`);
    }
  }
  return "";
}

function formatTrackTime(time: Optional<number>, type: "ms" | "s" = "ms", split?: string) {
  if (!time) return "0:00";
  split ||= ":";
  let base;
  if (type === "ms") {
    base = 1000;
  } else {
    base = 1;
  }
  const minutes = Math.floor(time / (60 * base));
  const seconds = Math.floor((time % (60 * base)) / base);
  const paddedSeconds = seconds.toString().padStart(2, "0");
  return `${minutes}${split}${paddedSeconds}`;
}

function padNumber(num: number, length: number) {
  return num.toString().padStart(length, "0");
}

function isChangeDay() {
  const { data } = getPersistSnapshot();
  const lastDate = data.lastRefreshCookieDate;
  return typeof lastDate !== "number" || lastDate !== new Date().getDate();
}

export const Time = {
  formatTrackDate,
  formatTrackTime,
  padNumber,
  isChangeDay
};
