import { useAnimate } from "motion/react";
import { useProgressSync } from "@/common/hooks/use-progress-sync";

export function useProgressMotionSync(props: {
  track: Optional<NeteaseTrackModel>;
  onUpdate: NormalFunc<[percent: number]>;
}) {
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const sync = useProgressSync({
    ...props,
    onSync: ({ buffer, percent }, immediate) => {
      const duration = immediate || document.hidden ? 0 : 1;
      if (percent !== undefined && percentScope.current) {
        percentAnimate(
          percentScope.current,
          { width: `${percent}%` },
          { duration, ease: "linear" }
        );
      }
      if (buffer !== undefined && bufferScope.current) {
        bufferAnimate(
          bufferScope.current,
          { width: `${buffer}%` },
          { duration: buffer <= 1 ? 0 : duration, ease: "linear" }
        );
      }
    }
  });

  return { ...sync, percentScope, bufferScope };
}
