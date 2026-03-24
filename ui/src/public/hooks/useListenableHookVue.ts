import { Listenable } from "@mahiru/ui/public/models/Listenable";
import { ref, triggerRef } from "vue";

export default function useListenableHookVue<T extends Listenable>(listenable: T) {
  const data = ref(listenable);

  listenable.addListener(() => {
    triggerRef(data);
  });

  return data;
}
