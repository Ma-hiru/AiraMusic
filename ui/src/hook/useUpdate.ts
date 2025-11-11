import { useCallback, useState } from "react";

interface Update {
  (): void;
  count: number;
}

export function useUpdate(): Update {
  const [count, setCount] = useState(0);

  const update = <Update>useCallback(() => setCount((c) => c + 1), []);
  update.count = count;

  return update;
}
