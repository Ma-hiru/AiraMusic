type PlaylistMarkIdProps =
  | { type: "search"; keyword: Undefinable<string> }
  | {
      id: Optional<number | string>;
      type: "album" | "artist" | "playlist";
    };

export function playlistMarkId(props: PlaylistMarkIdProps): Undefinable<string> {
  if (props.type === "search") {
    if (!props.keyword) return;
    return `search-${props.keyword}`;
  }
  if (!props.id) return;
  switch (props.type) {
    case "playlist":
      return `playlist-${props.id}`;
    case "album":
      return `album-${props.id}`;
    case "artist":
      return `artist-${props.id}`;
  }
}
