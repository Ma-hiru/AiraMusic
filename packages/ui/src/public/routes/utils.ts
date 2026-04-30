import { PlaylistSource } from "@mahiru/ui/public/enum";
import { Location } from "react-router-dom";

export class PlaylistPathUtils {
  readonly base;
  readonly history;
  readonly like;

  constructor(base?: string) {
    this.base = base || "/playlist";
    this.history = this.generate(null, PlaylistSource.History);
    this.like = this.generate(null, PlaylistSource.Like);
  }

  generate(id: Optional<number | string>, source: Optional<PlaylistSource>) {
    const search = new URLSearchParams();
    id && search.set("id", String(id));
    source && search.set("source", String(source));
    return `${this.base}?${search.toString()}`;
  }

  parse(location: Location, search: URLSearchParams) {
    const result = {
      source: null as Nullable<PlaylistSource>,
      id: null as Nullable<string>
    };
    if (location.pathname.startsWith(this.base)) {
      result.source = search.get("source") as Nullable<PlaylistSource>;
      result.id = search.get("id");
    }
    return result;
  }
}
