import { z } from 'zod';

export const productPRDSchema = z.object({
  productName: z.string().min(1),
  workingTitle: z.string().min(1).optional(),
  productDescription: z.string().min(1),
  targetUser: z.string().min(1),
  problemStatement: z.string().min(1),
  coreFunctionality: z.array(z.string().min(1)).min(1),
  technicalRequirements: z.string().min(1),
  suggestedTechStack: z.object({
    framework: z.string().min(1),
    language: z.string().min(1),
    keyDependencies: z.array(z.string()),
  }),
  mvpScope: z.string().min(1),
  successCriteria: z.array(z.string().min(1)).min(1),
  uniqueValue: z.string().min(1),
});
