import { LLMChain } from 'langchain/chains';
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  PromptTemplate,
} from 'langchain/prompts';
import { getSmartModel } from './models.util';
import {
  CORRECTION_SYSTEM_PROMPT,
  DENSITY_PROMPT,
  SUMMARIZE_SYSTEM_PROMPT,
  VERIFICATION_SYSTEM_PROMPT,
} from '../prompts/summarization.prompts';
import { OperationMode } from '../enums/operation-mode.enum';
import { StructuredOutputParser, OutputFixingParser } from 'langchain/output_parsers';
import { FILE_SUMMARY_SCHEMA } from '../schemas/file-summarization.schema';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { AST } from '../models';

const DEFAULT_RUNS = 3;

// Initialize the LLM
const turboLlm = getSmartModel({ operationMode: OperationMode.Gpt4Turbo_STD });
const stdLlm = getSmartModel({ operationMode: OperationMode.OpenAI_STD });
const azureLlm = getSmartModel({ operationMode: OperationMode.AZURE_STD });
const parser = StructuredOutputParser.fromZodSchema(FILE_SUMMARY_SCHEMA);
const fixParser = OutputFixingParser.fromLLM(turboLlm as ChatOpenAI, parser);

const createChain = async (
  messages: (SystemMessagePromptTemplate | AIMessagePromptTemplate | HumanMessagePromptTemplate)[]
) => {
  const promptTemplate = ChatPromptTemplate.fromMessages(messages);
  const tokenCount = await stdLlm.getNumTokens(await promptTemplate.format({}));
  console.log('Token Count:', tokenCount);
  const llm = getModelBasedOnSize(tokenCount);

  return new LLMChain({
    llm,
    prompt: promptTemplate,
  });
};

export const generateFileSummary = async (
  fileContent: string,
  fileName: string,
  runs = DEFAULT_RUNS
): Promise<AST['fileSummaries']> => {
  // Initialize the system prompt
  const systemPrompt = SystemMessagePromptTemplate.fromTemplate(SUMMARIZE_SYSTEM_PROMPT);

  // Initialize the user prompt with the initial input
  const filePrompt = HumanMessagePromptTemplate.fromTemplate(fileContent.replace(/{/g, '{{').replace(/}/g, '}}'));

  // Initialize the LLMChain with the model determined by the token count
  let chain = await createChain([systemPrompt, filePrompt]);
  let verificationResponse = '';
  let verificationQuestions = '';
  let result = '';

  try {
    for (let i = 0; i < runs; i++) {
      console.log(`running ${i + 1} run for file: ${fileName}`);
      result = (await chain.call({})).text;

      if (!i) {
        // chain of verification
        const verificationSystemPrompt = SystemMessagePromptTemplate.fromTemplate(VERIFICATION_SYSTEM_PROMPT);
        const previousSummary = result.replace(/{/g, '{{').replace(/}/g, '}}');
        const previousSummaryPrompt = SystemMessagePromptTemplate.fromTemplate(previousSummary);
        // ask indepenent question
        verificationQuestions = (await (await createChain([verificationSystemPrompt, previousSummaryPrompt])).call({}))
          .text;
        const correctionPrompt = await PromptTemplate.fromTemplate(CORRECTION_SYSTEM_PROMPT).format({
          questions: verificationQuestions,
        });

        const independentAnalysisPrompt = SystemMessagePromptTemplate.fromTemplate(correctionPrompt);
        // independent response
        verificationResponse = (await (await createChain([independentAnalysisPrompt, filePrompt])).call({})).text;
      }

      const assistantPrompt = AIMessagePromptTemplate.fromTemplate(result.replace(/{/g, '{{').replace(/}/g, '}}'));
      const densityPrompt = HumanMessagePromptTemplate.fromTemplate(
        await PromptTemplate.fromTemplate(DENSITY_PROMPT).format({
          independentAnalysis: verificationResponse,
          independentReviewerQuestions: verificationQuestions,
        })
      );

      chain = await createChain([systemPrompt, filePrompt, assistantPrompt, densityPrompt]);
    }

    const parsedResult = (await fixParser.parse(result)) as AST['fileSummaries'][0];
    console.log({ summary: parsedResult, fileName });

    return {
      [fileName]: parsedResult,
    };
  } catch (error) {
    console.error('Error', error);
    return {};
  }
};

const getModelBasedOnSize = (tokenCount: number) => {
  return turboLlm;
  if (tokenCount < 2000) {
    return stdLlm;
  } else if (tokenCount < 26000) {
    return azureLlm;
  } else {
  }
};
