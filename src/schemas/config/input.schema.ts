import { z } from 'zod';

export const InputSchema = z.object({
  repositories: z.array(z.string()).describe('List of repositories to be included in the index.'),
  excludedProjects: z.array(z.string()).describe('List of projects that should be excluded from Nx repositories.'),
  // TODO: Specs will be added as part of next task(s)
  specs: z.array(z.string()).describe('List of documents/specs that should be included in the index.'),
  store: z
    .object({
      directory: z.string().describe('Location where the Vector Store should be generated.'),
    })
    .describe('Specific configuration for DevBot Vector Store'),
});

export type InputConfiguration = z.infer<typeof InputSchema>;
