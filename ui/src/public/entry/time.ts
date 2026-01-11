import Dayjs from "dayjs";
import { AddLocalStore, WithLocalStore } from "@mahiru/ui/public/store/local";

@AddLocalStore
export class TimeClass {
  formatTrackDate(time?: number, split?: string) {
    if (time) {
      const date = Dayjs(time);
      const now = Dayjs();
      split ||= "-";
      if (now.diff(date, "seconds") < 10) {
        return "刚刚";
      } else if (date.year() === now.year()) {
        return date.format(`MM${split}DD`);
      } else {
        return date.format(`YYYY${split}MM${split}DD`);
      }
    }
    return "";
  }

  formatTrackTime(time: Optional<number>, unit: "ms" | "s" = "ms", split?: string) {
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

  padNumber(num: number, length: number) {
    return num.toString().padStart(length, "0");
  }

  getCacheTimeLimit(time: number, unit: "seconds" | "hour" | "day" | "minute") {
    let limit = 0;
    switch (unit) {
      case "seconds":
        limit = time * 1000;
        break;
      case "minute":
        limit = time * 60 * 1000;
        break;
      case "hour":
        limit = time * 60 * 60 * 1000;
        break;
      case "day":
        limit = time * 24 * 60 * 60 * 1000;
        break;
    }
    return limit;
  }

  isChangeDay() {
    return this.localSnapshot.User.LastRefreshCookiesDay !== new Date().getDate();
  }
}

export interface TimeClass extends WithLocalStore {}

export const Time = new TimeClass();
