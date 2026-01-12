import { computed, ComputedRef, MaybeRef, onUnmounted, ref, unref, watch } from "vue";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { AppScheme } from "@mahiru/ui/public/utils/dev";

export type Options = {
  id?: string | number;
  onCacheHit?: (file: string, id: string) => void;
  update?: boolean;
  timeLimit?: number;
  method?: string;
  pause?: boolean;
  injectCacheRequest?: NormalFunc<[requestCache: (controller?: AbortController) => void]>;
};

export function useFileCacheVue(
  url: MaybeRef<Undefinable<string>>,
  options?: ComputedRef<Options>
) {
  const finalURL = ref<string>();
  const resolvedOptions = computed(() => {
    const assertURL = unref(url);
    return {
      id: options?.value.id ?? assertURL,
      method: options?.value.method ?? "GET",
      pause: options?.value.pause ?? false,
      update: options?.value.update,
      timeLimit: options?.value.timeLimit,
      onCacheHit: options?.value.onCacheHit,
      injectCacheRequest: options?.value.injectCacheRequest
    } satisfies Options;
  });
  let controller: Undefinable<AbortController> = undefined;

  function request(controller?: AbortController) {
    if (controller?.signal.aborted) return;
    const assertURL = unref(url);
    if (!assertURL) return;
    CacheStore.checkOrStoreAsync(
      assertURL,
      resolvedOptions.value.id,
      resolvedOptions.value.method,
      resolvedOptions.value.update,
      resolvedOptions.value.timeLimit,
      controller?.signal
    )
      .then((check) => {
        if (controller?.signal.aborted) return;
        if (check?.ok && check.index.file) {
          const raw = new URL(check.index.file);
          raw.searchParams.set("mime", check.index.type);
          const path = raw.toString();
          if (path !== finalURL.value) finalURL.value = path;
          requestIdleCallback(() => {
            resolvedOptions.value.onCacheHit?.(path, check.index.id);
          });
        } else if (finalURL.value !== assertURL) {
          finalURL.value = assertURL;
        }
      })
      .catch(() => {
        if (controller?.signal.aborted) return;
        finalURL.value = assertURL;
      });
  }

  function start() {
    controller?.abort();
    controller = new AbortController();
    requestAnimationFrame(() => request(controller));
  }

  watch(
    () => [unref(url), resolvedOptions.value.id, resolvedOptions.value.pause],
    () => {
      const assertURL = unref(url);
      if (!assertURL || !resolvedOptions.value.id || resolvedOptions.value.pause) {
        finalURL.value = undefined;
        return;
      } else if (
        !assertURL.startsWith("http") ||
        assertURL.startsWith("file") ||
        assertURL.startsWith(AppScheme)
      ) {
        finalURL.value = assertURL;
        return;
      } else {
        start();
      }
    }
  );

  watch(
    () => resolvedOptions.value.injectCacheRequest,
    (fn) => fn?.(request),
    { immediate: true }
  );

  onUnmounted(() => {
    controller?.abort();
  });

  return finalURL;
}
