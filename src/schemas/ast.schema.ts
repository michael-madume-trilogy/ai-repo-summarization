import { z } from 'zod';

// TODO: Export as type so we can remove AST from models and reuse schema
export const AST_SCHEMA = z
  .object({
    question: z.string().describe('A question you have about the ABSTRACT SYNTAX TREE of the repository'),
    files: z
      .array(z.string())
      .optional()
      .describe(
        "An array of FULL file paths. (skip it if you don't know the exact relative path you want to search for)",
      ),
    codebaseInfo: z
      .array(
        z.object({
          repository: z
            .string()
            .optional()
            .describe('The name of the repository containing file that is being parsed into AST.'),
          fileName: z.string().optional().describe('The name of the file being parsed into AST.'),
          imports: z.array(z.string()).optional().describe('The imported modules in the file.'),
          functions: z.array(z.string()).optional().describe('An array of function names.'),
          classes: z.array(z.string()).optional().describe('An array of class names.'),
          interfaces: z.array(z.string()).optional().describe('An array of interface names.'),
          tags: z.array(z.string()).optional().describe('An array of HTML tag names.'),
          json: z.unknown().optional().describe('Any other data in the form of JSON.'),
        }),
      )
      .optional()
      .describe('An array of information about each file.'),
  })
  .describe(
    'The schema for Abstract Syntax Trees of your codebase, generated from parsed TypeScript and HTML files. As well as a question you have',
  );
