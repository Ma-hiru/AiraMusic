import { startTransition, useEffect, useLayoutEffect, useState } from "react";
import { Net } from "@mahiru/ui/utils/net";

const handlers = new Set<NormalFunc<[status: NetworkStatus]>>();
Net.addNetworkChangeListener(() => {
  Net.checkOnline().then((status) => {
    handlers.forEach((cb) => cb(status));
  });
});

export function useNetwork() {
  const [netStatus, setNetStatus] = useState<NetworkStatus>("ok");

  useLayoutEffect(() => {
    Net.checkOnline().then(setNetStatus);
  }, []);

  useEffect(() => {
    const handler = (status: NetworkStatus) => {
      startTransition(() => {
        setNetStatus(status);
      });
    };
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }, []);

  return netStatus;
}
