import { exec, execSync } from 'child_process';
import { join } from 'path';
import { Project, SourceFile } from 'ts-morph';
import { promisify } from 'util';
import * as path from 'path';
import { AST } from '../models';
import * as fs from 'fs';
import { Element, load } from 'cheerio';
import { createDocumentsFromInput } from './document.util';
import { Document } from 'langchain/document';
import { HNSWLib } from 'langchain/vectorstores/hnswlib';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { confirm } from '@inquirer/prompts';
import { ConfigurationService } from '../services';
import * as ts from 'typescript';
import { js as beautify } from 'js-beautify';
import { generateFileSummary } from './summarization.util';
import { PromptTemplate } from 'langchain/prompts';
import { SUMMARIZATION_INPUT_PROMPT } from '../prompts/summarization.prompts';
import { getSmartModel } from './models.util';
import { OperationMode } from '../enums/operation-mode.enum';

const NOT_APPLICABLE_STRING = 'Not Applicable Here';
export class StoreUtil {
  private readonly execPromise = promisify(exec);

  constructor(private readonly configuration = new ConfigurationService()) {}

  public async initialize() {
    console.time('[STORE_UTIL]: Indexing');
    if (fs.existsSync(this.configuration.storePath)) {
      const reIndex = await confirm({
        message: 'You have the vector stores setup. Would you want to re-index it?',
        default: false,
      });
      if (reIndex) {
        await this.indexRepos();
      }
    } else {
      fs.mkdirSync(this.configuration.storePath, { recursive: true });
      await this.indexRepos();
    }
    console.timeEnd('[STORE_UTIL]: Indexing');
  }

  public async updateASTWithSummaries() {
    // Get all the AST files from the storage
    const astFiles = fs
      .readdirSync(this.configuration.storePath)
      .filter((file) => file.startsWith('ast-') && file.endsWith('.json'));

    // Process each AST file
    for (const astFile of astFiles) {
      const filePath = path.join(this.configuration.storePath, astFile);
      const ast: AST = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Generate summaries for the AST
      await this.summarizeRepoFiles({ ast, filePath });
    }
  }

  private async processInBatches(
    items: string[],
    batchSize: number,
    ast: AST,
    filePath: string,
    callback: (item: string) => Promise<AST['fileSummaries']>
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const results: AST['fileSummaries'][] = [];
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(callback));
      results.push(...batchResults);
      await this.saveBatchToFile(ast, results, filePath);
    }

  }

  public async saveBatchToFile(ast: AST, summaries: AST['fileSummaries'][], filePath: string) {
    // Update the AST with the summaries
    const fileSummaries = summaries.reduce<{ [key: string]: { summary: any } }>((acc, summary) => {
      acc[Object.keys(summary)[0]] = {
        summary: Object.values(summary)[0],
      };
      return acc;
    }, {});

    ast.fileSummaries = { ...(ast.fileSummaries ?? {}), ...fileSummaries };

    // Save the updated AST back to the file
    fs.writeFileSync(filePath, JSON.stringify(ast, null, 2), 'utf8');
  }

  public async summarizeRepoFiles(input: { ast: AST; filePath: string }) {
    const { ast, filePath } = input;

    const baseUrl = ast.codebaseInfo[0].repository;

    const filteredFiles = ast.files
      .map((file) => path.resolve(baseUrl, file))
      .filter((file) => {
        const ext = path.extname(file);
        return ['.html', '.ts', '.json', '.yaml', '.yml'].includes(ext) && !ast.fileSummaries?.[file];
      });

    await this.processInBatches(filteredFiles, 50, ast, filePath, async (fileName) => {
      const ext = path.extname(fileName);
      let fileContent = '';
      try {
        fileContent = await fs.promises.readFile(fileName, 'utf8');
      } catch (error) {
        console.error(`Error reading file ${fileName}: ${error}`);
      }

      switch (ext) {
        case '.yaml':
        case '.yml':
        case '.json': {
          const contentPrompt = await PromptTemplate.fromTemplate(SUMMARIZATION_INPUT_PROMPT).format({
            fileName,
            fileContent,
            dependencies: NOT_APPLICABLE_STRING,
            compiledFile: NOT_APPLICABLE_STRING,
          });
          const totalTokenCount = await getSmartModel({ operationMode: OperationMode.OpenAI_STD }).getNumTokens(
            contentPrompt
          );
          return await generateFileSummary(
            totalTokenCount > 120_000 ? contentPrompt.slice(0, 100_000) : contentPrompt,
            fileName
          );
        }

        case '.html': {
          const codebaseInfos = ast.codebaseInfo.filter((info) => info.imports.includes(fileName));
          const extractedFiles = codebaseInfos.flatMap((info) => {
            return [
              info.fileName,
              ...info.imports
                .filter((importFile) => importFile.startsWith(info.repository))
                .filter((importFile) => ['.css', '.scss'].includes(path.extname(importFile))),
            ];
          });
          const dependencies =
            [
              await Promise.all(
                extractedFiles.map(async (fileName) => {
                  try {
                    return await fs.promises.readFile(fileName, 'utf8');
                  } catch (error) {
                    console.error(`Error reading file ${fileName}: ${error}`);
                    return '';
                  }
                })
              ),
            ].join('\n') || NOT_APPLICABLE_STRING;
          const contentPrompt = await PromptTemplate.fromTemplate(SUMMARIZATION_INPUT_PROMPT).format({
            fileName,
            fileContent,
            dependencies,
            compiledFile: NOT_APPLICABLE_STRING,
          });
          const totalTokenCount = await getSmartModel({ operationMode: OperationMode.OpenAI_STD }).getNumTokens(
            contentPrompt
          );
          return await generateFileSummary(
            totalTokenCount > 120_000 ? contentPrompt.slice(0, 100_000) : contentPrompt,
            fileName
          );
        }

        case '.ts': {
          const codebaseInfo = ast.codebaseInfo.find((info) => info.fileName === fileName);
          const extractedFiles = codebaseInfo?.imports
            .filter((importFile) => importFile?.startsWith(codebaseInfo.repository))
            .map(async (fileName) => {
              try {
                return await fs.promises.readFile(fileName, 'utf8');
              } catch (error) {
                console.error(`Error reading file ${fileName}: ${error}`);
                return '';
              }
            });
          const dependencies = (await Promise.all(extractedFiles || [])).join('\n') || NOT_APPLICABLE_STRING;

          const contentPrompt = await PromptTemplate.fromTemplate(SUMMARIZATION_INPUT_PROMPT).format({
            fileName,
            fileContent: codebaseInfo.sourceCode,
            dependencies,
            compiledFile: codebaseInfo.compiledCode,
          });
          const totalTokenCount = await getSmartModel({ operationMode: OperationMode.OpenAI_STD }).getNumTokens(
            contentPrompt
          );
          return await generateFileSummary(
            totalTokenCount > 120_000 ? contentPrompt.slice(0, 100_000) : contentPrompt,
            fileName
          );
        }
        default:
          return null;
      }
    });
  }

  private async getGitFiles(directory: string): Promise<string[]> {
    const { stdout, stderr } = await this.execPromise('git ls-files', {
      cwd: directory,
    });

    if (stderr) {
      console.error(`Error: ${stderr}`);
      throw 'Could not retrieve files';
    }

    return stdout
      .split('\n')
      .filter((fileName) => fileName.length > 0)
      .filter(
        (fileName) => !this.configuration.get('excludedProjects').some((exclusion) => fileName.includes(exclusion))
      );
  }

  public async indexRepos(): Promise<void> {
    for (const repositoryDir of this.configuration.get('repositories')) {
      const indexes = await this.indexRepo(repositoryDir);
      // TODO: Merge ASTs into single store
      await this.storeJSON(indexes.ast, `ast-${path.basename(repositoryDir)}`);
    }
  }

  private async storeDocs(documents: Document[], store: string): Promise<void> {
    console.time(`[STORE_UTIL]: Storing Documents for ${store}`);
    const vectorFolder = join(this.configuration.storePath, store);
    fs.mkdirSync(vectorFolder, { recursive: true });
    const vectorStore = await HNSWLib.fromDocuments(documents, new OpenAIEmbeddings());
    await vectorStore.save(vectorFolder);
    console.timeEnd(`[STORE_UTIL]: Storing Documents for ${store}`);
  }

  private async storeJSON(ast: AST, store: string): Promise<void> {
    fs.writeFileSync(join(this.configuration.storePath, `${store}.json`), JSON.stringify(ast, null, 2), 'utf-8');
  }

  private async indexRepo(repo: string): Promise<{
    ast: AST;
    files: string[];
  }> {
    repo = repo.trim();
    const repoName: string = path.basename(repo);
    const files: string[] = await this.getGitFiles(repo);

    const ast: AST = await this.generateAST(repoName, repo, files);

    return {
      files,
      ast,
    };
  }

  private async generateAST(repoName: string, repo: string, files: string[]): Promise<AST> {
    console.time('[STORE_UTIL]: Generating AST');
    console.log(`[${new Date().toUTCString()}] [STORE_UTIL]: Generating AST for ${repoName}`);
    const ast: AST = {
      files,
      codebaseInfo: [...(await this.handleTypeScriptFile(repo, files))],
    };
    console.timeEnd('[STORE_UTIL]: Generating AST');
    return ast;
  }

  private async generateASTDoc(repoName: string, ast: AST): Promise<Document[]> {
    console.time('[STORE_UTIL]: Generating AST Documents');
    console.log(`[${new Date().toUTCString()}] [STORE_UTIL]: Generating AST Documents for ${repoName}`);
    const astDocs: Document[] = [];
    for (const val of ast.codebaseInfo) {
      const astDoc = await createDocumentsFromInput(JSON.stringify(val), {
        source: val.fileName,
        repository: repoName,
      });
      astDocs.push(...astDoc);
    }
    console.timeEnd('[STORE_UTIL]: Generating AST Documents');
    return astDocs;
  }

  private async generateDocs(repoName: string, repo: string, files: string[]): Promise<Document[]> {
    console.time('[STORE_UTIL]: Generating Documents');
    console.log(`[${new Date().toUTCString()}] [STORE_UTIL]: Generating Documents for ${repoName}`);
    const documents: Document[] = [];

    for (const file of files) {
      const content = fs.readFileSync(join(repo, file), 'utf8');
      const doc = await createDocumentsFromInput(
        `file-path: ${file}

    ${content}
    `,
        {
          repository: repoName,
          repositoryUrl: repo,
          source: file,
        }
      );
      documents.push(...doc);
    }
    console.timeEnd('[STORE_UTIL]: Generating Documents');
    return documents;
  }

  private async handleTypeScriptFile(repo: string, lsFiles: string[]): Promise<any[]> {
    const project = new Project({
      tsConfigFilePath: join(repo, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });

    const tsFiles = lsFiles.filter((file) => path.extname(file) === '.ts');
    const sourceFiles = tsFiles.map((file) => project.addSourceFileAtPath(join(repo, file)));

    const results = await Promise.all(
      sourceFiles.map(async (sourceFile) => {
        console.log(sourceFile.getFilePath());
        const imports = await this.resolveImports(sourceFile, repo);
        const functions = this.extractFunctions(sourceFile);
        const classes = this.extractClasses(sourceFile, imports, repo);
        const interfaces = this.extractInterfaces(sourceFile);
        const { sourceCode, compiledCode } = this.transpileSourceFile(sourceFile);

        return {
          repository: repo,
          fileName: sourceFile.getFilePath(),
          imports,
          functions,
          classes,
          interfaces,
          sourceCode,
          compiledCode,
        };
      })
    );

    return results;
  }

  private readTsConfig(repo: string): ts.ParsedCommandLine {
    const configPath = ts.findConfigFile(repo, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) throw new Error('Could not find tsconfig.json');
    const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (readResult.error)
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext([readResult.error], {
          getCanonicalFileName: (fileName) => fileName,
          getCurrentDirectory: ts.sys.getCurrentDirectory,
          getNewLine: () => ts.sys.newLine,
        })
      );
    return ts.parseJsonConfigFileContent(readResult.config, ts.sys, path.dirname(configPath));
  }

  private async resolveImports(sourceFile: SourceFile, repo: string): Promise<string[]> {
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, path.join(repo, 'tsconfig.json'));
    const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
    const config = ts.parseJsonConfigFileContent(readResult.config, ts.sys, path.dirname(configPath));
    const paths = config.options.paths;
    const baseUrl = config.options.baseUrl;

    const checks = sourceFile.getImportDeclarations().map(async (importDeclaration) => {
      const importPath = importDeclaration.getModuleSpecifierValue();

      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const resolvedPath = path.resolve(path.dirname(sourceFile.getFilePath()), importPath);
        try {
          // Check if it's a file
          const stats = await fs.promises.stat(resolvedPath);
          if (stats.isFile()) {
            return resolvedPath;
          } else {
            // If it's a directory, check for an index.ts file
            await fs.promises.access(`${resolvedPath}/index.ts`);
            return `${resolvedPath}/index.ts`;
          }
        } catch {
          try {
            await fs.promises.access(`${resolvedPath}.ts`);
            return `${resolvedPath}.ts`;
          } catch {
            return resolvedPath;
          }
        }
      } else {
        let resolvedPath = importPath;

        for (const pathKey in paths) {
          const pattern = pathKey.replace('*', '(.*)');
          const regex = new RegExp(`^${pattern}$`);
          const match = importPath.match(regex);

          if (match) {
            const matchedWildcard = match[1];
            for (const pathPattern of paths[pathKey]) {
              const resolvedWildcardPath = pathPattern.replace('*', matchedWildcard);
              const fullyResolvedPath = path.resolve(path.dirname(configPath), baseUrl, resolvedWildcardPath);

              try {
                const stats = await fs.promises.stat(fullyResolvedPath);
                if (stats.isFile()) {
                  resolvedPath = fullyResolvedPath;
                  break;
                } else {
                  await fs.promises.access(`${fullyResolvedPath}/index.ts`);
                  resolvedPath = `${fullyResolvedPath}/index.ts`;
                  break;
                }
              } catch {
                try {
                  await fs.promises.access(`${fullyResolvedPath}.ts`);
                  resolvedPath = `${fullyResolvedPath}.ts`;
                  break;
                } catch {
                  continue;
                }
              }
            }
            if (resolvedPath !== importPath) {
              break;
            }
          }
        }

        if (resolvedPath === importPath) {
          const absolutePath = path.resolve(path.dirname(configPath), baseUrl, importPath);
          try {
            await fs.promises.access(absolutePath);
            resolvedPath = absolutePath;
          } catch {
            try {
              await fs.promises.access(`${absolutePath}.ts`);
              resolvedPath = `${absolutePath}.ts`;
            } catch {
              return resolvedPath;
            }
          }
        }

        return resolvedPath;
      }
    });

    return Promise.all(checks);
  }

  private extractFunctions(sourceFile: SourceFile): any[] {
    return sourceFile.getFunctions().map((func) => ({
      name: func.getName(),
      parameters: func.getParameters().map((param) => ({
        name: param.getName(),
        type: param.getType()?.getText(),
      })),
      returnType: func.getReturnType().getText(),
    }));
  }

  private extractClasses(sourceFile: SourceFile, imports: string[], repo: string): any[] {
    return sourceFile.getClasses().map((classDeclaration) => {
      const methods = classDeclaration.getMethods().map((method) => ({
        name: method.getName(),
        parameters: method.getParameters().map((param) => ({
          name: param.getName(),
          type: param.getType()?.getText(),
        })),
        returnType: method.getReturnType().getText(),
        decorators: method.getDecorators().map((decorator) => ({
          name: decorator.getName(),
          arguments: decorator.getArguments().map((arg) => arg.getText()),
        })),
      }));

      const classDecorators = classDeclaration.getDecorators().map((decorator) => {
        const decoratorArguments = decorator.getArguments().map((arg) => arg.getFullText());
        const decoratorFiles = decoratorArguments
          .map((arg: string): string[] => {
            const templateUrlMatch = arg.match(/templateUrl: '(.+)',/);
            const styleUrlsMatch = arg.match(/styleUrls: \[(.+)\],/);

            const files = [];
            if (templateUrlMatch && templateUrlMatch[1]) {
              files.push(templateUrlMatch[1]);
            }
            if (styleUrlsMatch && styleUrlsMatch[1]) {
              const styles = styleUrlsMatch[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
              files.push(...styles);
            }
            return files;
          })
          .flat()
          .map((file: string): string | null => {
            try {
              const resolvedPath = path.resolve(path.dirname(sourceFile.getFilePath()), file);
              if (fs.existsSync(resolvedPath)) {
                return resolvedPath;
              } else {
                console.error(`File does not exist at path: ${resolvedPath}`);
                return file;
              }
            } catch (e) {
              console.error(`Error resolving file path: ${e}`);
              return null;
            }
          })
          .filter((file: string | null): file is string => Boolean(file));

        imports.push(...decoratorFiles);
        imports = imports.map((importPath: string): string => {
          console.log(sourceFile.getFilePath());
          try {
            const resolvedPath = path.resolve(path.dirname(sourceFile.getFilePath()), importPath);
            if (fs.existsSync(resolvedPath)) {
              return resolvedPath;
            } else {
              console.error(`File does not exist at path: ${resolvedPath}`);
              return importPath;
            }
          } catch (e) {
            console.error(`Error resolving import path: ${e}`);
            return importPath;
          }
        });

        return {
          name: decorator.getName(),
          arguments: decoratorArguments,
        };
      });

      return {
        name: classDeclaration.getName(),
        decorators: classDecorators,
        methods,
      };
    });
  }

  private extractInterfaces(sourceFile: SourceFile): any[] {
    return sourceFile.getInterfaces().map((interfaceDeclaration) => ({
      name: interfaceDeclaration.getName(),
      properties: interfaceDeclaration.getProperties().map((property) => ({
        name: property.getName(),
        type: property.getType().getText(),
      })),
    }));
  }

  private transpileSourceFile(sourceFile: SourceFile): { sourceCode: string; compiledCode: string } {
    const sourceCode = sourceFile.getFullText();
    const compiledCode = ts.transpileModule(sourceCode, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;

    const beautifiedCode = beautify(compiledCode, { indent_size: 2 });

    return { sourceCode, compiledCode: beautifiedCode };
  }

  private handleHTMLFile(repo: string, lsFiles: string[]) {
    const files = lsFiles.filter((file) => {
      return path.extname(file) === '.html';
    });

    return files.map((file) => {
      const content = fs.readFileSync(join(repo, file), 'utf8');
      const $ = load(content);

      // Get all the tags
      const tags: {
        tag: string;
        attrs: {
          [name: string]: string;
        };
      }[] = [];

      // Store the information
      return {
        repository: repo,
        fileName: file,
        tags,
      };
    });
  }

  private handleJSONFile(repo: string, lsFiles: string[]) {
    const files = lsFiles.filter((file) => {
      return path.extname(file) === '.json';
    });

    return files.map((file) => {
      const content = fs.readFileSync(join(repo, file), 'utf8');
      let json = {};
      try {
        json = JSON.parse(content);
      } catch (error) {}
      // Store the information
      return {
        repository: repo,
        fileName: file,
        json,
      };
    });
  }

  public isNxRepo(dir: string): boolean {
    try {
      const nxFilePath = path.join(dir, 'nx.json');
      execSync(`test -f ${nxFilePath}`);
      // If the command didn't throw an error, it means the file exists, so it's an Nx repo.
      return true;
    } catch {
      // If the command threw an error, the file doesn't exist, so it's not an Nx repo.
      return false;
    }
  }

  private async writeNxDepGraphToFile(repo: string): Promise<void> {
    try {
      const depGraphPath = `${path.join(__dirname, '../../', this.configuration.storePath, 'dep-graph.json')}`;
      // Create the full DepGraph as Nx CLI doesn't support built-in filtering
      const { stdout, stderr } = await this.execPromise(`nx dep-graph --file="${depGraphPath}"`, { cwd: repo });

      // TODO: Improve this as we shouldn't caught exception locally
      if (stderr) {
        console.error(`Error: ${stderr}`);
        throw new Error(stderr);
      }

      if (this.configuration.get('excludedProjects').length) {
        // Filter projects within the Dependency Graph
        const file = fs.readFileSync(depGraphPath, 'utf8');
        const depGraph = JSON.parse(file);

        // Filter the nodes
        depGraph.graph.nodes = Object.fromEntries(
          Object.entries(depGraph.graph.nodes).filter(
            ([key]) => !this.configuration.get('excludedProjects').some((exclusion) => key.includes(exclusion))
          )
        );

        // Filter the dependencies (adjust as needed based on the dependencies structure)
        depGraph.graph.dependencies = Object.fromEntries(
          Object.entries(depGraph.graph.dependencies).filter(
            ([key]) => !this.configuration.get('excludedProjects').some((exclusion) => key.includes(exclusion))
          )
        );

        // Write the modified JSON back to a file
        fs.writeFileSync(depGraphPath, JSON.stringify(depGraph));
      }
      console.log(
        `[${new Date().toUTCString()}] [STORE_UTIL]: Dependency graph has been written for ${path.basename(repo)}`
      );
    } catch (error) {
      console.error(`An error occurred: ${error}`);
      throw error;
    }
  }
}
