import { Listenable } from "../utils/listenable";
import { useUpdate } from "./use-update";
import { useEffect } from "react";

export function useListenable<T extends Listenable>(listenable: T, disable = false) {
  const update = useUpdate();

  useEffect(() => {
    if (disable) return;
    return listenable.addListener(update);
  }, [disable, listenable, update]);

  return listenable;
}
