import { useEffect } from "react";
import { Listenable } from "@/common/utils/listenable";

import { useUpdate } from "./use-update";

export function useListenable<T extends Listenable<any>>(listenable: T, disable = false) {
  const update = useUpdate();

  useEffect(() => {
    if (disable) return;
    return listenable.addListener(update);
  }, [disable, listenable, update]);

  return listenable;
}
