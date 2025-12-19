import { startTransition, useEffect, useState } from "react";

export const enum Stage {
  Immediately,
  First,
  Second,
  Finally
}

export function useStage() {
  const [stage, setStage] = useState(Stage.Immediately);

  useEffect(() => {
    requestAnimationFrame(() => {
      startTransition(() => {
        setStage(Stage.First);
      });
      requestAnimationFrame(() => {
        startTransition(() => {
          setStage(Stage.Second);
        });
        requestIdleCallback(() => {
          setStage(Stage.Finally);
        });
      });
    });
  }, []);

  return { stage };
}
