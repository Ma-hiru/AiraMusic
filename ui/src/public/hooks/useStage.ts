import { startTransition, useCallback, useEffect, useState } from "react";
import { Stage } from "@mahiru/ui/public/enum/stage";

export function useStage() {
  const [stage, setStage] = useState(Stage.Immediately);

  const startStagePipeline = useCallback(() => {
    setStage(Stage.Immediately);

    requestAnimationFrame(() => {
      startTransition(() => {
        setStage(Stage.First);
      });

      requestAnimationFrame(() => {
        startTransition(() => {
          setStage(Stage.Second);
        });

        requestIdleCallback(() => {
          startTransition(() => {
            setStage(Stage.Finally);
          });
        });
      });
    });
  }, []);

  useEffect(() => {
    startStagePipeline();
  }, [startStagePipeline]);

  return { stage };
}
