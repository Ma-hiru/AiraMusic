import { Device } from "@mahiru/ui/utils/device";
import { useEffect, useState } from "react";

let cachedPlatform: NodeJS.Platform | "unknown" = "unknown";

export function usePlatform() {
  const [platform, setPlatform] = useState(cachedPlatform);

  useEffect(() => {
    if (cachedPlatform === "unknown") {
      Device.platform.then((p) => {
        setPlatform(p);
        cachedPlatform = p;
      });
    }
  }, []);

  return platform;
}
