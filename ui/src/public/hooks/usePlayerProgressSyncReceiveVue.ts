import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { onMounted, onUnmounted, Ref, ref } from "vue";

export function usePlayerProgressSyncReceiveVue() {
  const progressSync = ref<PlayerProgress>({
    currentTime: 0,
    duration: 0,
    buffered: 0,
    size: 0
  });

  let unsubscribable: Undefinable<NormalFunc>;
  onMounted(() => {
    unsubscribable = Renderer.addMessageHandler("playerProgressSync", "main", (data) => {
      progressSync.value = data;
    });
  });
  onUnmounted(() => {
    unsubscribable?.();
  });

  return { progressSync: progressSync as Ref<PlayerProgress>, requestPlayerProgressSync };
}

const requestPlayerProgressSync = debounce(() => {
  Renderer.sendMessage("requestPlayerProgressSync", "main", undefined);
}, 500);
