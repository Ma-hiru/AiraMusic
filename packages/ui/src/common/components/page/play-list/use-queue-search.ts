import { useRef, useMemo, useState, useEffect } from "react";
import { SearchTrack } from "@mahiru/wasm";
import { NeteaseTrack, type NeteaseTrackRecord } from "@/common/netease/models";

type SearchResult = {
  query: string;
  indexes: number[];
  tracks: NeteaseTrack[];
};

function sameTracks(current: NeteaseTrack[], previous: NeteaseTrack[]) {
  return (
    current === previous ||
    (current.length === previous.length &&
      current.every((track, index) => track === previous[index]))
  );
}

export function useQueueSearch(tracks: NeteaseTrackRecord[], query: string, active = true) {
  const details = useMemo(() => tracks.map((track) => track.detail), [tracks]);
  const searcher = useRef<Nullable<{ index: SearchTrack; tracks: NeteaseTrack[] }>>(null);
  const [result, setResult] = useState<Nullable<SearchResult>>(null);

  useEffect(() => {
    return () => {
      searcher.current?.index.free();
      searcher.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !query) {
      setResult(null);
      return;
    }
    const search = (searcher.current ??= { tracks: [], index: new SearchTrack() });
    // list() 会返回新数组，但歌曲详情是只读对象；只有内容或顺序变化才重建索引。
    if (!sameTracks(details, search.tracks)) {
      search.index.update(NeteaseTrack.toSearchStructString(details));
      search.tracks = details;
    }
    setResult({ query, tracks: details, indexes: Array.from(search.index.search(query)) });
  }, [active, details, query]);

  if (!query) return tracks;
  if (!result || result.query !== query || !sameTracks(details, result.tracks)) return [];
  return result.indexes.flatMap((index) => (tracks[index] ? [tracks[index]!] : []));
}
