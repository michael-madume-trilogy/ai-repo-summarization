import { OpenAI } from 'langchain/llms/openai';
import { LoggerCallbackHandler } from './logger.util';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { AnthropicInput, ChatAnthropic } from 'langchain/chat_models/anthropic';
import { OperationMode } from '../enums/operation-mode.enum';
import { ConfigurationService } from '../services';

type ModelOptions = {
  temperature?: number;
  useLogger?: boolean;
  verbose?: boolean;
  chatModel?: boolean;
  useAnthropic?: boolean;
  useAzure?: boolean;
  maxConcurrency?: number;
  maxRetries?: number;
};

const configuration = new ConfigurationService();

export const getModel = (
  modelName: string,
  {
    temperature = 0,
    useLogger = false,
    chatModel = false,
    useAnthropic = false,
    useAzure = false,
    verbose = false,
    maxConcurrency = 10,
    maxRetries = 5,
  }: ModelOptions
) => {
  const config = {
    temperature,
    openAIApiKey: configuration.openAIKey,
    modelName,
    callbacks: useLogger ? [new LoggerCallbackHandler()] : [],
    verbose,
    maxConcurrency,
    maxRetries,
  };
  const org = {
    organization: configuration.openAIApiOrganizationId,
  };

  if (useAzure) {
    const azureConfig = {
      ...config,
      azureOpenAIApiKey: configuration.azureOpenAiKey,
      azureOpenAIApiInstanceName: configuration.azureOpenAiInstanceName,
      azureOpenAIApiDeploymentName: configuration.azureOpenAiDeploymentName,
      azureOpenAIApiVersion: configuration.azureOpenAiVersion,
    };
    delete azureConfig.openAIApiKey;
    return new OpenAI(azureConfig);
  }

  if (useAnthropic) {
    const anthropicConfig = {
      ...config,
      anthropicApiKey: configuration.anthropicApiKey,
      modelName: 'claude-2',
    };
    delete anthropicConfig.openAIApiKey;
    return new ChatAnthropic(anthropicConfig);
  }

  return chatModel ? new ChatOpenAI(config, org) : new OpenAI(config, org);
};

export const getDumbModel = (options: ModelOptions = {}) => getModel('gpt-3.5', { ...options });
export const getLargeContextDumbModel = (options: ModelOptions = {}) => getModel('gpt-3.5-turbo-16k', { ...options });

export const getAnthropicChatModel = (options: AnthropicInput) => {
  options = { ...options, anthropicApiKey: configuration.anthropicApiKey };
  return new ChatAnthropic(options);
};

export const getSmartModel = (options: ModelOptions & { operationMode?: OperationMode } = {}) => {
  switch (options.operationMode) {
    case OperationMode.OpenAI_STD:
      return getModel('gpt-4', { ...options });
    case OperationMode.AZURE_STD:
      return getModel('gpt-4-32k', { ...options, useAzure: true });
    default:
    case OperationMode.Gpt4Turbo_STD:
      return getModel('gpt-4-1106-preview', { ...options });
  }
};

export const isLargeContextMode = (operationMode: OperationMode) => {
  return [OperationMode.AZURE_STD, OperationMode.Gpt4Turbo_STD].includes(operationMode);
};
