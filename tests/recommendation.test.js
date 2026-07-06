const { buildFeatureText } = require('../src/utils/bookFeatures');

const tokenize = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
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

const cosineSimilarity = (vectorA, vectorB) => {
  const terms = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  terms.forEach((term) => {
    const a = vectorA[term] || 0;
    const b = vectorB[term] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  });

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const averageVectors = (vectors) => {
  const combined = {};
  const counts = {};

  vectors.forEach((vector) => {
    Object.entries(vector).forEach(([term, score]) => {
      combined[term] = (combined[term] || 0) + score;
      counts[term] = (counts[term] || 0) + 1;
    });
  });

  Object.keys(combined).forEach((term) => {
    combined[term] /= counts[term];
  });

  return combined;
};

const getContentScores = (likedBooks, candidates) => {
  const documents = [
    ...likedBooks.map((book) => buildFeatureText(book)),
    ...candidates.map((book) => buildFeatureText(book)),
  ];

  const vectors = buildTfidfVectors(documents);
  const likedVectors = vectors.slice(0, likedBooks.length);
  const candidateVectors = vectors.slice(likedBooks.length);
  const profileVector = averageVectors(likedVectors);
  const scores = {};

  candidates.forEach((candidate, index) => {
    scores[candidate.id] = cosineSimilarity(profileVector, candidateVectors[index]);
  });

  return scores;
};

const {
  jaccardSimilarity,
  cosineSimilarity: exportedCosineSimilarity,
  normalizeScores,
} = require('../src/utils/similarity');

const {
  CONTENT_WEIGHT,
  COLLABORATIVE_WEIGHT,
} = require('../src/services/recommendationService');

describe('Recommendation ML utilities', () => {
  it('calculates jaccard similarity between user taste profiles', () => {
    const setA = new Set(['a', 'b', 'c']);
    const setB = new Set(['b', 'c', 'd']);

    expect(jaccardSimilarity(setA, setB)).toBeCloseTo(0.5, 5);
  });

  it('calculates cosine similarity between sparse vectors', () => {
    const vectorA = { fantasy: 0.8, adventure: 0.4 };
    const vectorB = { fantasy: 0.6, adventure: 0.2, dragons: 0.3 };

    expect(exportedCosineSimilarity(vectorA, vectorB)).toBeGreaterThan(0.85);
  });

  it('ranks similar books higher with TF-IDF content scoring', () => {
    const likedBooks = [
      {
        id: 'liked-1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        categories: ['Science Fiction'],
        description: 'Desert planet politics spice worms empire',
      },
    ];

    const candidates = [
      {
        id: 'candidate-1',
        title: 'Dune Messiah',
        authors: ['Frank Herbert'],
        categories: ['Science Fiction'],
        description: 'Paul Atreides empire desert politics prophecy',
      },
      {
        id: 'candidate-2',
        title: 'Cooking Basics',
        authors: ['Chef Example'],
        categories: ['Cooking'],
        description: 'Kitchen recipes pasta sauces desserts',
      },
    ];

    const scores = getContentScores(likedBooks, candidates);

    expect(scores['candidate-1']).toBeGreaterThan(scores['candidate-2']);
  });

  it('exposes hybrid model weights', () => {
    expect(CONTENT_WEIGHT + COLLABORATIVE_WEIGHT).toBeCloseTo(1, 5);
  });

  it('normalizes score ranges to zero-one', () => {
    const normalized = normalizeScores({ a: 2, b: 5, c: 8 });
    expect(normalized.a).toBe(0);
    expect(normalized.c).toBe(1);
  });
});
