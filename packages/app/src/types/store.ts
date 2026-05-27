import { z } from "zod";

export const CacheStoreConfigSchema = z.object({
  ttl: z.string(),
  path: z.string(),
  capacity: z.number()
});

export type CacheStoreConfig = z.infer<typeof CacheStoreConfigSchema>;
