const { tokenize } = require('../../utils/tfidf');

const buildTermFrequencies = (tokens) => {
  const frequencies = {};

  tokens.forEach((token) => {
    frequencies[token] = (frequencies[token] || 0) + 1;
  });

  const maxFrequency = Math.max(...Object.values(frequencies), 1);

  Object.keys(frequencies).forEach((token) => {
    frequencies[token] = 0.5 + (0.5 * frequencies[token]) / maxFrequency;
  });

  return frequencies;
};

const buildVocabulary = (documents) => {
  const tokenizedDocs = documents.map((document) => tokenize(document));
  const documentCount = tokenizedDocs.length || 1;
  const documentFrequency = {};

  tokenizedDocs.forEach((tokens) => {
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach((token) => {
      documentFrequency[token] = (documentFrequency[token] || 0) + 1;
    });
  });

  const vocabulary = {};

  Object.entries(documentFrequency).forEach(([token, frequency]) => {
    const idf = Math.log((documentCount + 1) / (frequency + 1)) + 1;
    vocabulary[token] = idf;
  });

  return vocabulary;
};

const vectorizeDocument = (document, vocabulary) => {
  const tokens = tokenize(document);
  const termFrequencies = buildTermFrequencies(tokens);
  const vector = {};

  Object.entries(termFrequencies).forEach(([token, tf]) => {
    if (vocabulary[token]) {
      vector[token] = tf * vocabulary[token];
    }
  });

  return vector;
};

const sparseToDense = (sparseVector, termOrder) => (
  termOrder.map((term) => sparseVector[term] || 0)
);

const buildTermOrder = (vocabulary) => Object.keys(vocabulary).sort();

module.exports = {
  buildVocabulary,
  vectorizeDocument,
  sparseToDense,
  buildTermOrder,
};
