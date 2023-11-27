import { z } from 'zod';

export const FILE_SUMMARY_SCHEMA = z
  .object({
    fileDescription: z.string().describe('A detailed description of the file and its role within the larger codebase.'),
    tag: z
      .enum(['ui', 'dataAccess', 'utility', 'feature'])
      .describe('A tag that categorizes the file based on its primary function.'),
    elementsDetail: z
      .unknown()
      .describe(
        "A detailed breakdown of the file's constituent elements such as functions, variables, and methods. Each element includes a description of its purpose and interactions with other code elements."
      ),
    algorithmicLogic: z
      .object({
        description: z.string().describe('A detailed explanation of the algorithmic logic within the file.'),
        rationale: z.string().describe('The reasoning behind the chosen algorithmic logic.'),
      })
      .optional()
      .describe('An optional section that provides an in-depth explanation of the algorithmic logic used in the file.'),
    businessLogic: z
      .object({
        rules: z.string().describe('The specific business rules that the code in the file implements.'),
        workflows: z.string().describe('How the code executes business workflows.'),
      })
      .optional()
      .describe('An optional section that provides a detailed account of the business logic implemented in the file.'),
    flowDescription: z
      .object({
        initialization: z.string().describe('A description of how the flow within the file starts.'),
        processingSteps: z
          .array(z.string())
          .describe("A list of the specific processing steps within the file's flow."),
      })
      .optional()
      .describe('An optional section that documents the entire code flow within the file.'),
  })
  .describe('File Summary Schema');
