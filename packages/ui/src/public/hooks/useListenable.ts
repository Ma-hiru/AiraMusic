import { Listenable } from "@mahiru/ui/public/utils/listenable";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import { useEffect } from "react";

export function useListenable<T extends Listenable>(listenable: T, disable = false) {
  const update = useUpdate();

  useEffect(() => {
    if (disable) return;
    return listenable.addListener(update);
  }, [disable, listenable, update]);

  return listenable;
}
