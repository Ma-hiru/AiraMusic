import Dayjs from "dayjs";

export function formatTimeToMMDD(time?: number) {
  if (time) {
    const date = Dayjs(time);
    const now = Dayjs();
    if (date.year() === now.year()) {
      return date.format("MM-DD");
    } else {
      return date.format("YYYY-MM-DD");
    }
  }
  return "";
}

export function formatDurationToMMSS(duration: number) {
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const paddedSeconds = seconds.toString().padStart(2, "0");
  return `${minutes}:${paddedSeconds}`;
}
