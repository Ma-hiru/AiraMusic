import { debounce } from "lodash-es";
import { onMounted, onUnmounted, Ref, ref } from "vue";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

export function usePlayerTrackSyncReceiveVue() {
  const trackSync = ref<Nullable<PlayerTrackStatus>>(null);

  let unsubscribable: Undefinable<NormalFunc>;
  onMounted(() => {
    requestPlayerTrackSync();
    unsubscribable = Renderer.addMessageHandler("playerTrackSync", "main", (data) => {
      trackSync.value = data;
    });
  });
  onUnmounted(() => {
    unsubscribable?.();
  });

  return { trackSync: trackSync as Ref<Nullable<PlayerTrackStatus>>, requestPlayerTrackSync };
}

const requestPlayerTrackSync = debounce(() => {
  Renderer.sendMessage("requestPlayerTrackSync", "main", undefined);
}, 500);
