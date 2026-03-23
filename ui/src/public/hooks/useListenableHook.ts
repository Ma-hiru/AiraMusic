import { Listenable } from "@mahiru/ui/public/models/Listenable";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import { useEffect } from "react";

export default function useListenableHook<T extends Listenable>(listenable: T) {
  const update = useUpdate();
  useEffect(() => listenable.addListener(update), [listenable, update]);
  return listenable;
}
