import type { NetFetchRequest, NetFetchResponse } from "@mahiru/ipc/types";

export async function fetchFromNode({ init, input }: NetFetchRequest): Promise<NetFetchResponse> {
  const response = await fetch(input, init);
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: response.body === null ? null : await response.arrayBuffer(),
    url: response.url,
    redirected: response.redirected,
    type: response.type
  };
}
