import { onUnmounted, shallowRef, triggerRef } from "vue";
import { Listenable } from "@mahiru/ui/public/utils/listenable";

export default function useListenableHookVue<T extends Listenable>(listenable: T) {
  const state = shallowRef(listenable);

  const listener = () => triggerRef(state);
  listenable.addListener(listener);
  onUnmounted(() => listenable.removeListener(listener));

  return state;
}
