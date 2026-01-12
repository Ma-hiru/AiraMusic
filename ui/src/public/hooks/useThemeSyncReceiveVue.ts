import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { onMounted, onUnmounted, ref } from "vue";

export function useThemeSyncReceiveVue() {
  const themeSync = ref<ThemeSync>({
    secondaryColor: "#ffffff",
    mainColor: "#fc3d49",
    KMeansColor: ["#fc3d49", "#ffffff"],
    textColorOnMain: "#000000",
    backgroundImage: undefined
  });

  let unsubscribable: Undefinable<NormalFunc>;
  onMounted(() => {
    unsubscribable = Renderer.addMessageHandler("themeSync", "main", (data) => {
      themeSync.value = data;
    });
  });
  onUnmounted(() => {
    unsubscribable?.();
  });

  return { themeSync, requestThemeSync };
}

const requestThemeSync = debounce(() => {
  Renderer.sendMessage("requestThemeSync", "main", undefined);
}, 500);
