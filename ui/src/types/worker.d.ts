type KMeansWorkerArgs = {
  id: number;
  url: string;
};

type KMeansWorkerResult = {
  ok: boolean;
  id: number;
  result: string[];
  error?: string;
};
