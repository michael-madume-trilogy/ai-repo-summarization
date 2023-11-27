import { BaseCallbackHandler } from 'langchain/callbacks';
import { Serialized } from 'langchain/load/serializable';
import { Document } from 'langchain/document';
import { ChainValues, AgentAction, AgentFinish, LLMResult } from 'langchain/schema';
import path from 'path';
import { createLogger, format, transports } from 'winston';

// Generate filename with timestamp
const timestamp = Date.now();
const filename = path.join(`./logs/${timestamp}_app.log`);

// Create a logger instance
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    }),
  ),
  transports: [new transports.File({ filename })],
});

export default logger;

export class LoggerCallbackHandler extends BaseCallbackHandler {
  name = 'LoggerCallbackHandler';
  startTime: Date;
  endTime: Date;
  retrieverStartTime: Date;
  retrieverEndTime: Date;
  chainDurationInSec = 0;
  retrieverDurationInSec = 0;
  completionTokens = 0;
  promptTokens = 0;
  totalTokens = 0;

  async handleChainStart?(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    runType?: string | undefined,
    name?: string | undefined,
  ): Promise<any> {
    // logger.info(`Entering new ${chain.id} chain...`);
    this.startTime = new Date();
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?:
      | {
          inputs?: Record<string, unknown> | undefined;
        }
      | undefined,
  ): Promise<any> {
    // logger.info('Finished chain.');
    this.endTime = new Date();
    this.chainDurationInSec = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.startTime) {
      this.startTime = new Date();
    }
    return;
  }

  async handleLLMEnd?(
    output: LLMResult,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ): Promise<any> {
    this.endTime = new Date();
    this.chainDurationInSec = (this.endTime.getTime() - this.startTime.getTime()) / 1000;
    if (output.llmOutput && output.llmOutput.tokenUsage) {
      this.completionTokens += output.llmOutput.tokenUsage.completionTokens;
      this.promptTokens += output.llmOutput.tokenUsage.promptTokens;
      this.totalTokens += output.llmOutput.tokenUsage.totalTokens;
    }
  }

  async handleRetrieverStart?(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined,
  ): Promise<any> {
    this.retrieverStartTime = new Date();
  }

  async handleRetrieverEnd?(
    documents: Document<Record<string, any>>[],
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ): Promise<any> {
    this.retrieverEndTime = new Date();
    this.retrieverDurationInSec = (this.retrieverEndTime.getTime() - this.retrieverStartTime.getTime()) / 1000;
  }

  async handleText(text: string) {
    logger.info(text);
  }
}
