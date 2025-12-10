import Dayjs from "dayjs";
import { getPersistSnapshot } from "@mahiru/ui/store";

function formatDate(time?: number, split?: string) {
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

function formatTrackDurationMS(ms: number, split?: string) {
  if (!ms) return "0:00";
  split ||= ":";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const paddedSeconds = seconds.toString().padStart(2, "0");
  return `${minutes}${split}${paddedSeconds}`;
}

function formatTrackCurrentTimeSecond(s: number) {
  if (!s) return "0:00";
  const minutes = Math.floor(s / 60);
  const seconds = Math.floor(s % 60);
  const paddedSeconds = seconds.toString().padStart(2, "0");
  return `${minutes}:${paddedSeconds}`;
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
  formatDate,
  formatTrackDurationMS,
  formatTrackCurrentTimeSecond,
  padNumber,
  isChangeDay
};
