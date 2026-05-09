import { onUnmounted, shallowRef, triggerRef } from "vue";
import { Listenable } from "@mahiru/ui/public/utils/listenable";

export function useListenable<T extends Listenable>(listenable: T, disable = false) {
  const state = shallowRef(listenable);

  if (disable) return state;

  const listener = () => triggerRef(state);
  listenable.addListener(listener);
  onUnmounted(() => listenable.removeListener(listener));

  return state;
}
