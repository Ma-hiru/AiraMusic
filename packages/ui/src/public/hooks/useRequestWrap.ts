import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";
import { useStableArray } from "@mahiru/ui/public/hooks/useStableArray";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import _AppNet from "@mahiru/ui/public/source/electron/services/net";

export function useRequestStatusWrap<R, Args extends unknown[]>(request: PromiseFunc<Args, R>) {
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [data, setData] = useState<Nullable<R>>(null);

  const fetchData: PromiseFunc<[signal: AbortSignal, props: Args]> = useCallback(
    async (...args) => {
      const signal = args[0];

      if (signal.aborted) return;
      setStatus("loading");

      request(...args[1])
        .then((res) => {
          if (signal.aborted) return;
          startTransition(() => {
            setStatus("success");
            setData(res);
          });
        })
        .catch((err) => {
          if (signal.aborted) return;
          Log.error(err);
          startTransition(() => {
            setStatus("error");
            setData(null);
          });
        });
    },
    [request]
  );

  return {
    status,
    data,
    fetchData
  };
}

export function useRequestAutoRun<Args extends unknown[]>(
  request: PromiseFunc<[signal: AbortSignal, props: Args]>,
  /** 与React dependency comparison一致，只比较数组元素 */
  props: Args
) {
  const requestRef = useRef(request);
  const stableProps = useStableArray(props);
  requestRef.current = request;

  const reload = useUpdate();

  useEffect(() => {
    const cancel = new AbortController();
    const request = requestRef.current;

    Log.info("requestAutoRun", "trigger run");
    request(cancel.signal, stableProps);

    return () => cancel.abort();
  }, [stableProps, reload.count]);

  return {
    reload
  };
}

export function useRequestAutoRetry<Args extends unknown[]>(
  request: PromiseFunc<[signal: AbortSignal, props: Args]>,
  /** 与React dependency comparison一致，只比较数组元素 */
  props: Args,
  skip?: NormalFunc<[], boolean>
) {
  const requestRef = useRef(request);
  const skipRef = useRef(skip);
  const stableProps = useStableArray(props);
  requestRef.current = request;
  skipRef.current = skip;

  const reload = useUpdate();

  useEffect(() => {
    const cancel = new AbortController();

    const unsubscribe = _AppNet.autoRetryRequest(
      () => {
        Log.info("requestAutoRetry", "trigger run");
        const request = requestRef.current;
        return request(cancel.signal, stableProps);
      },
      () => {},
      skipRef.current
    );

    return () => {
      cancel.abort();
      unsubscribe();
    };
  }, [stableProps, reload.count]);

  return {
    reload
  };
}
