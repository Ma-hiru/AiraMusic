import { type FC, memo } from "react";
import { useAtomValue } from "jotai";
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
