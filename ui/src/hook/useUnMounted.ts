import { useEffect } from "react";

export function useUnMounted(clear: NormalFunc) {
  useEffect(() => clear, [clear]);
}
