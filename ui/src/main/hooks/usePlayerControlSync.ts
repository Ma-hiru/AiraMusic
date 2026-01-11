import { useEffect } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

export function usePlayerControlSync(syncWins: WindowType[]) {
  const { PlayerCoreGetter } = usePlayerStore(["PlayerCoreGetter"]);
  const player = PlayerCoreGetter();

  useEffect(() => {
    return Renderer.addMessageHandler("playerControl", null, ({ from, data }) => {
      if (!syncWins.includes(from)) return;
      switch (data) {
        case "play":
          return player.play();
        case "pause":
          return player.pause();
        case "last":
          return player.last(true);
        case "next":
          return player.next(true);
        case "mute":
          return player.mute();
      }
    });
  }, [player, syncWins]);
}
