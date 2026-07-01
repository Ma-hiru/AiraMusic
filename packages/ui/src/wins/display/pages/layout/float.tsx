import { useAtomValue } from "jotai";
import { memo, type FC } from "react";
import { scrollActionsAtom } from "@/wins/display/atoms/layout";
import Float from "@/common/components/layout/float";

const DisplayFloat: FC<{ className?: string }> = ({ className }) => {
  const scrollActions = useAtomValue(scrollActionsAtom);

  return (
    <Float
      className={className ?? "right-4 bottom-6 z-40"}
      scrollTop={scrollActions.scrollTop}
      fastLocate={scrollActions.fastLocate}
    />
  );
};

export default memo(DisplayFloat);
