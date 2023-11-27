import { z } from 'zod';

export const EnvironmentSchema = z.object({
  DEVBOT_CONFIG: z.string().describe('Location of the DevBot Input Configuration JSON'),
  OPENAI_API_KEY: z.string().describe('OpenAI API Key'),
  GH_ACCESS_KEY: z.string().describe('GitHub Access Key'),
  OPENAI_API_ORGANIZATION_ID: z.string().describe('OpenAI API Organization ID'),
  AZURE_OPEN_AI_KEY: z.string().describe('Azure OpenAI Key'),
  AZURE_OPEN_AI_INSTANCE_NAME: z.string().describe('Azure OpenAI Instance Name'),
  AZURE_OPEN_AI_DEPLOYMENT_NAME: z.string().describe('Azure OpenAI Deployment Name'),
  AZURE_OPEN_AI_VERSION: z.string().describe('Azure OpenAI Version'),
  ANTHROPIC_API_KEY: z.string().describe('Anthropic API Key'),
});

export type Environment = z.infer<typeof EnvironmentSchema>;