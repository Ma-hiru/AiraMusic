import type { NeteaseTrack } from "@/common/netease/models";
import type { QQSong } from "@/common/lib/qq-music-lyric/model";

const VERSION_GROUPS = {
  acoustic: ["acoustic"],
  cover: ["cover", "翻唱"],
  demo: ["demo"],
  edit: ["edit", "tv size", "anime edit"],
  instrumental: ["instrumental", "伴奏", "纯音乐"],
  live: ["live", "现场"],
  remix: ["remix", "mix"],
  version: ["version", "ver"]
};
const VERSION_WORDS = Object.values(VERSION_GROUPS).flat();

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[·・•]/g, " ")
    .replace(/[，,、/&]/g, " ")
    .replace(/[（）()[\]【】「」『』《》<>]/g, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function versionTags(value: string) {
  const text = normalize(value);
  return new Set(
    Object.entries(VERSION_GROUPS)
      .filter(([, words]) => words.some((word) => text.includes(word)))
      .map(([tag]) => tag)
  );
}

function coreTitle(value: string) {
  let text = normalize(value);
  for (const word of VERSION_WORDS) {
    const pattern = /[a-z]/i.test(word)
      ? new RegExp(`(?:^|\\s)${word}(?=\\s|$)`, "g")
      : new RegExp(word + "版?", "g");
    text = text.replace(pattern, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

function scoreTitle(source: string, target: string) {
  const normalizedSource = normalize(source);
  const normalizedTarget = normalize(target);
  if (normalizedSource === normalizedTarget) return 60;

  const sourceCore = coreTitle(source);
  const targetCore = coreTitle(target);
  if (sourceCore === targetCore) return 50;
  if (sourceCore && (sourceCore.includes(targetCore) || targetCore.includes(sourceCore))) return 25;
  return 0;
}

function scoreArtists(source: string[], target: string[]) {
  const sourceSet = new Set(source.map(normalize).filter(Boolean));
  const targetSet = new Set(target.map(normalize).filter(Boolean));
  const matched = [...sourceSet].filter((artist) => targetSet.has(artist)).length;

  if (!matched) return 0;
  if (matched === sourceSet.size && matched === targetSet.size) return 25;
  if (matched === sourceSet.size) return 20;
  return 10;
}

function scoreDuration(sourceMs: number, targetSeconds?: number) {
  if (!targetSeconds || targetSeconds <= 0 || sourceMs <= 0) return 0;

  const diff = Math.abs(sourceMs - targetSeconds * 1000);
  if (diff <= 1000) return 15;
  if (diff <= 3000) return 10;
  if (diff <= 7000) return 5;
  if (diff >= 15000) return -20;
  return -5;
}

export function scoreSong(track: NeteaseTrack, song: QQSong): number {
  let score = scoreTitle(track.name, song.title);

  const sourceVersions = versionTags(track.name);
  const targetVersions = versionTags(song.title);
  if ([...sourceVersions].some((tag) => !targetVersions.has(tag))) score -= 20;
  if ([...targetVersions].some((tag) => !sourceVersions.has(tag))) score -= 20;

  score += scoreArtists(
    track.artist,
    song.singer.map((singer) => singer.name)
  );
  score += scoreDuration(track.dt, song.interval);

  if (
    track.al.name &&
    song.album?.name &&
    coreTitle(track.al.name) === coreTitle(song.album.name)
  ) {
    score += 5;
  }

  return score;
}
