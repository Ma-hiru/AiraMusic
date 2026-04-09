import { startTransition, useCallback, useDebugValue, useLayoutEffect, useState } from "react";
import { Stage } from "@mahiru/ui/public/enum/stage";
import { nextFrame, nextIdle } from "@mahiru/ui/public/utils/frame";

export function useStage() {
  const [stage, setStage] = useState(Stage.Immediately);
  const restart = useCallback(() => {
    setStage(Stage.Immediately);
  }, []);
  useDebugValue(stage);
  useLayoutEffect(() => {
    let cancelled = false;
    const run = async () => {
      // stage 0: immediately
      setStage(Stage.Immediately);

      //  stage 1: next frame
      nextFrame().then(() => {
        if (cancelled) return;
        startTransition(() => setStage(Stage.First));

        // stage 2: next idle
        nextIdle(1500).then(() => {
          if (cancelled) return;
          startTransition(() => setStage(Stage.Second));

          // stage 3: next idle in 5s
          nextIdle(5000).then(() => {
            if (cancelled) return;
            startTransition(() => setStage(Stage.Finally));
          });
        });
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stage, restart };
}
