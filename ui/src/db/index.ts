import axios from "axios";
import Dexie from "dexie";

const db = new Dexie("simple-cloud-music");

db.version(1).stores({
  trackSources: '&id, createTime',
  trackDetail: '&id, updateTime',
  lyric: '&id, updateTime',
  album: '&id, updateTime',
});

export function cacheTrackSource(){}

export default db;