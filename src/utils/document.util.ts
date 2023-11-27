import { TokenTextSplitter } from 'langchain/text_splitter';

// Creating and manipulating documents
export const createDocumentsFromInput = async (input: string, metaData: any, chunkSize = 2500) => {
  const splitter = new TokenTextSplitter({
    encodingName: 'gpt2',
    chunkSize,
    chunkOverlap: 0,
  });
  return await splitter.createDocuments([input], [metaData]);
};
