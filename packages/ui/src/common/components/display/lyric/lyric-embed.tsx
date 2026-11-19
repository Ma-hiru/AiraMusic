import { memo, type FC } from "react";
import { Log } from "@/common/lib/log";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";

export type LyricArtistClick = NormalFunc<[id: number], void | Promise<unknown>>;

function lyricEmbedArtist(reference?: string): number | undefined {
  if (!reference) return;
  try {
    const url = new URL(reference);
    if (url.protocol !== "orpheus:" || url.hostname !== "nm" || url.pathname !== "/artist/home")
      return;
    const id = Number(url.searchParams.get("id"));
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
  } catch {
    return;
  }
}

function avatarURL(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return;
  }
}

const LyricEmbedContent: FC<{
  entries: LyricEmbed[];
  onArtistClick?: LyricArtistClick;
  crossAlign?: "left" | "right" | "center";
}> = ({ onArtistClick, entries, crossAlign = "left" }) => (
  <div className="flex w-full flex-col gap-1.5 font-semibold" data-lyric-embed>
    {entries.map((entry) => (
      <div
        key={entry.position}
        className="flex flex-wrap items-center gap-y-1 whitespace-pre-wrap"
        style={{
          justifyContent:
            crossAlign === "center" ? "center" : crossAlign === "right" ? "flex-end" : "flex-start"
        }}>
        {entry.c.map((part, index) => {
          const artistId = lyricEmbedArtist(part.or);
          const avatar = avatarURL(part.li);
          const content = (
            <>
              {avatar && (
                <img
                  className="inline-block size-[1em] rounded-full object-cover"
                  alt=""
                  src={avatar}
                  loading="lazy"
                />
              )}
              <span>{part.tx}</span>
            </>
          );
          return artistId ? (
            <button
              key={index}
              className="inline-flex items-center gap-1 rounded-sm hover:opacity-70 focus-visible:outline-1 cursor-pointer"
              type="button"
              title={`查看歌手：${part.tx}`}
              onClick={async (event) => {
                event.stopPropagation();
                try {
                  if (onArtistClick) {
                    await onArtistClick(artistId);
                  } else {
                    await RendererWindow.display.reactReadyAwait();
                    RendererIPCMessageBus.display.deliver({ type: "artist", id: artistId });
                  }
                } catch (error) {
                  Log.warn("LyricEmbed", "打开歌手页面失败", artistId, error);
                }
              }}>
              {content}
            </button>
          ) : (
            <span key={index} className="inline-flex items-center gap-1">
              {content}
            </span>
          );
        })}
      </div>
    ))}
  </div>
);

export default memo(LyricEmbedContent);
