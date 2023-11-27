import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { ChatMessageHistory } from 'langchain/memory';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from 'langchain/schema';
import { join } from 'path';

const dirPath = './memory';

export const saveMemory = (messages: BaseMessage[], systemMessage?: string) => {
  // Extract the content property from the messages and store them in an array
  const chatMessages = messages
    .filter((message) => !(message instanceof SystemMessage))
    .map((message) => message.content);
  const data = {
    chatMessages,
    systemMessage: systemMessage || messages.find((message) => message instanceof SystemMessage)?.content,
  };
  // Prepare the complete path
  const filePath = join(dirPath, 'memory.json');

  // Check if directory exists, if not create it
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath);
  }

  // Write the contents array to the JSON file
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

export const loadPastMemory = (): ChatMessageHistory => {
  // Prepare the complete path
  const filePath = join(dirPath, 'memory.json');

  // If file doesn't exist, return an empty array
  if (!existsSync(filePath)) {
    return;
  }

  // Read and parse the file content
  const raw = readFileSync(filePath, 'utf-8');
  const messages: { chatMessages: string[]; systemMessage: string } = JSON.parse(raw);

  // Convert each message to an instance of either HumanMessage or AIMessage
  return new ChatMessageHistory([
    ...(messages.systemMessage ? [new SystemMessage(messages.systemMessage)] : []),
    ...messages.chatMessages.map((message, i) => {
      return i % 2 === 0 ? new HumanMessage(message) : new AIMessage(message);
    }),
  ]);
};

export const hasMemory = (): boolean => {
  // Prepare the complete path
  const filePath = join(dirPath, 'memory.json');

  // Check if file exists
  if (!existsSync(filePath)) {
    return false;
  }

  // Read file content
  const fileContent = readFileSync(filePath, 'utf-8');

  // Check if file has valid content
  try {
    const parsedContent = JSON.parse(fileContent);
    return (!!parsedContent.chatMessages && parsedContent?.chatMessages?.length) || !!parsedContent?.systemMessage;
  } catch (error) {
    return false;
  }
};
