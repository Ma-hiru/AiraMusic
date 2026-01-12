import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { onMounted, onUnmounted, Ref, ref } from "vue";

export function usePlayerStatusSyncReceiveVue() {
  const playerStatusSync = ref<Nullable<PlayerStatusSync>>(null);

  let unsubscribable: Undefinable<NormalFunc>;
  onMounted(() => {
    unsubscribable = Renderer.addMessageHandler("playerStatusSync", "main", (data) => {
      playerStatusSync.value = data;
    });
  });
  onUnmounted(() => {
    unsubscribable?.();
  });

  return {
    playerStatusSync: playerStatusSync as Ref<Nullable<PlayerStatusSync>>,
    requestPlayerStatusSync
  };
}

const requestPlayerStatusSync = debounce(() => {
  Renderer.sendMessage("requestPlayerStatusSync", "main", undefined);
}, 500);
