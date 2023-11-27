// ABSTRACT SYNTAX TREE
export interface AST {
  files?: string[];
  codebaseInfo?: {
    repository: string;
    fileName: string;
    imports?: string[];
    functions?: {
      name: string;
      parameters: {
        name: string;
        type: string;
      }[];
      returnType: string;
    }[];
    classes?: {
      name: string;
      decorators: {
        name: string;
        arguments: string[];
      }[];
      methods: {
        name: string;
        parameters: {
          name: string;
          type: string;
        }[];
        returnType: string;
        decorators: {
          name: string;
          arguments: string[];
        }[];
      }[];
    }[];
    interfaces?: {
      name: string;
      properties: {
        name: string;
        type: string;
      }[];
    }[];
    tags?: {
      tag: string;
      attrs: {
        [name: string]: string;
      };
    }[];
    json?: any;
    sourceCode?: string;
    compiledCode?: string;
  }[];
  fileSummaries?: {
    [fileName: string]: {
      summary: {
        fileDescription: string;
        tag: string;
        elementsDetail?: { [key: string]: any };
      };
    };
  };
  repoSummary?: {
    [key: string]: any;
  };
}
