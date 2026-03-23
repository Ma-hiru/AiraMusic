import AppRenderer from "@mahiru/ui/public/entry/renderer";
import { useEffect } from "react";
import { currentWindowType } from "@mahiru/ui/public/utils/dev";
import { Listenable } from "@mahiru/ui/public/models/Listenable";

let loaded = false;

AppRenderer.Message.listen("windowBus", "main", ({ action }) => {
  if (action === "close") AppRenderer.Event.normal.close();
});

export function useAppLoaded(condition?: Optional<Promise<void>>) {
  useEffect(() => {
    if (loaded) return;
    (condition || Promise.resolve())
      .then(() => {
        AppRenderer.Event.normal.show();
        AppRenderer.Message.send("windowBus", "all", {
          type: currentWindowType,
          action: "open"
        });
      })
      .catch(() => {
        AppRenderer.Event.normal.close();
        AppRenderer.Message.send("windowBus", "all", {
          type: currentWindowType,
          action: "close"
        });
      })
      .finally(() => {
        loaded = true;
      });
  }, [condition]);
}
