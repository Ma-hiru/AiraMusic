import { startTransition, useEffect, useRef, useState } from "react";
import { Stage } from "@mahiru/ui/public/enum/stage";

export function useStage() {
  const [stage, setStage] = useState(Stage.Immediately);
  const versionRef = useRef(0);

  const cancel = useRef(() => ++versionRef.current).current;

  const restart = useRef(() => {
    cancel();
    setStage(Stage.Immediately);
  }).current;

  useEffect(() => {
    const v = versionRef.current;
    const next = (stage: Stage, type: "frame" | "idle") => {
      if (type === "frame") {
        const id = requestAnimationFrame(() => {
          if (versionRef.current !== v) return;
          startTransition(() => setStage(stage));
        });
        return () => cancelAnimationFrame(id);
      } else {
        const id = requestIdleCallback(
          () => {
            if (versionRef.current !== v) return;
            startTransition(() => setStage(stage));
          },
          { timeout: 1000 }
        );
        return () => cancelIdleCallback(id);
      }
    };

    if (stage === Stage.Immediately) return next(Stage.First, "frame");
    if (stage === Stage.First) return next(Stage.Second, "frame");
    if (stage === Stage.Second) return next(Stage.Finally, "idle");

    return cancel;
  }, [cancel, stage]);

  return {
    stage,
    restart
  };
}
