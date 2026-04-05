import { startTransition, useDebugValue, useLayoutEffect, useState } from "react";
import { Stage } from "@mahiru/ui/public/enum/stage";
import { nextFrame, nextIdle } from "@mahiru/ui/public/utils/frame";

export function useStage() {
  const [stage, setStage] = useState(Stage.Immediately);
  useDebugValue(stage);
  useLayoutEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStage(Stage.Immediately);

      await nextFrame();
      if (cancelled) return;
      startTransition(() => setStage(Stage.First));

      await nextIdle(1500);
      if (cancelled) return;
      startTransition(() => setStage(Stage.Second));

      await nextIdle(5000);
      if (cancelled) return;
      startTransition(() => setStage(Stage.Finally));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stage };
}
