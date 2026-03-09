import { z } from 'zod';

export const planMetadataSchema = z.object({
  planFilePath: z.string().min(1).optional(),
  progressFilePath: z.string().min(1).optional(),
  phases: z.array(z.string()).optional(),
  totalTasks: z.number().int().min(0).optional(),
}).passthrough();
