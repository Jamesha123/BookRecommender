const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'has', 'was', 'were',
  'are', 'but', 'not', 'you', 'your', 'his', 'her', 'their', 'about', 'into', 'over',
  'after', 'before', 'between', 'through', 'during', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'too', 'very', 'can',
  'will', 'just', 'don', 'should', 'now', 'book', 'books', 'story', 'novel',
]);

const tokenize = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
};

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

const buildTfidfVectors = (documents) => {
  const tokenizedDocs = documents.map((document) => tokenize(document));
  const documentCount = tokenizedDocs.length;
  const documentFrequency = {};

  tokenizedDocs.forEach((tokens) => {
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach((token) => {
      documentFrequency[token] = (documentFrequency[token] || 0) + 1;
    });
  });

  return tokenizedDocs.map((tokens) => {
    const termFrequencies = buildTermFrequencies(tokens);
    const vector = {};

    Object.entries(termFrequencies).forEach(([token, tf]) => {
      const idf = Math.log((documentCount + 1) / (documentFrequency[token] + 1)) + 1;
      vector[token] = tf * idf;
    });

    return vector;
  });
};

module.exports = {
  STOPWORDS,
  tokenize,
  buildTfidfVectors,
};
